import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, forkJoin, of, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { GameDto } from '../../models/dtos/game-dto.model';
import { PlayerDto } from '../../models/dtos/player-dto.model';
import { Direction } from '../../models/enums/direction.enum';
import { Game } from '../../models/enums/game.enum';
import { NechtoCardAction } from '../../models/enums/nechto-card-action.enum';
import { NechtoCardType } from '../../models/enums/nechto-card-type.enum';
import { Role } from '../../models/enums/role.enum';
import { StepPhase } from '../../models/enums/step-phase.enum';
import { UserAction } from '../../models/enums/user-action';
import { GenericCard } from '../../models/types/card.type';
import { NechtoPlayerComponent } from '../../modules/games/modules/nechto/components/nechto-player/nechto-player.component';
import { NechtoTableComponent } from '../../modules/games/modules/nechto/components/nechto-table/nechto-table.component';
import { getRandomItem } from '../helpers/array.helpers';
import { CardHelpers } from '../helpers/card.helpers';
import { isNil, isNull, isUndefined } from '../helpers/type.helpers';
import { FirebaseService } from './firebase.service';
import { GameInfoService } from './game-info.service';
import { RatingService } from './rating.service';
import { RoomService } from './room.service';
import { UserService } from './user.service';

/**
 * Main service that works with the game.
 * It has major services as injected dependencies.
 */
@Injectable({
    providedIn: 'root'
})
export class GameService implements OnDestroy {
    public games$ = new BehaviorSubject<GameDto[]>([]);
    public currentGame$ = new BehaviorSubject<GameDto>(null);
    public playerStreamsUpdated$ = new Subject<void>();
    public playerComponentsUpdated$ = new BehaviorSubject<NechtoPlayerComponent[]>([]);
    public tableComponentUpdated$ = new BehaviorSubject<NechtoTableComponent>(null);
    public gameStopped$ = new Subject<void>();
    public get games() {
        return this.games$.value;
    }
    public get currentGame() {
        return this.currentGame$.value || new GameDto();
    }
    public get hasCurrentGame() {
        return !!this.currentGame.roomId;
    }
    public get currentGameTable() {
        return this.currentGame.table || {};
    }
    public get currentGameHands() {
        return this.currentGame.hands || {};
    }
    public get currentGameBorders() {
        return this.currentGame.borders || {};
    }
    public get currentGameDeck() {
        return this.currentGame.deck || [];
    }
    public get currentGameTrash() {
        return this.currentGame.trash || [];
    }
    public get currentStepPhases() {
        return this.currentGame.currentStepPhases || [];
    }
    public get previousStepPhases() {
        return this.currentGame.previousStepPhases || [];
    }
    public get lastCard(): GenericCard {
        return this.currentGame.lastCard || {} as GenericCard;
    }
    public get hasEnoughPlayers() {
        return this.roomService.isPlaying && this.getActivePlayersCount() >= this.ACTIVE_PLAYERS_NEEDED;
    }
    public get isBotPlaying() {
        return this.roomService.isGameMode() && this.getCurrentStepPlayerComponent() && this.getCurrentStepPlayerComponent().isBot;
    }
    public get hasReservedData() {
        return this.currentGame.reservedStepPhases.length && !!this.currentGame.reservedStepPlayerId;
    }
    public get canLeaveRoom() {
        return (
            !this.roomService.isGameMode()
            || this.roomService.isGameFinished()
            || this.isInactive()
            || !this.getActivePlayerId()
        ) && !!this.roomService.getSelectedRoomId();
    }

    private selectedGame: Game;
    private ACTIVE_PLAYERS_NEEDED = 4;
    private get playerComponents() {
        return this.playerComponentsUpdated$.value;
    }
    private get tableComponent() {
        return this.tableComponentUpdated$.value;
    }
    private destroy$ = new Subject<void>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly userService: UserService,
        private readonly roomService: RoomService,
        private readonly gameInfoService: GameInfoService,
        private readonly ratingService: RatingService,
        private readonly router: Router,
        private readonly cardHelpers: CardHelpers
    ) {
        this.firebaseService.listen(GameDto, 'games')
            .pipe(
                map((games) => {
                    this.games$.next(games);
                    return games;
                }),
                switchMap((games) => {
                    if (!this.roomService.roomsResolved) {
                        return forkJoin([of(games), this.roomService.resolveRooms()]);
                    } else {
                        return forkJoin([of(games), of(this.roomService.getRooms())]);
                    }
                }),
                tap(([games, _]) => {
                    const selectedRoomId = this.roomService.getSelectedRoomId();
                    const currentGameState = games.find((game) => game.roomId === selectedRoomId);
                    const previousGameState = this.currentGame;
                    const players = this.roomService.getRoomMembers(selectedRoomId).filter((item) => !item.isBot);

                    this.currentGame$.next(currentGameState);

                    if (previousGameState.roomId && !currentGameState && !players.length) {
                        this.navigateToLobby();
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        this.roomService.selectedRooms$.pipe(
            switchMap(() => {
                // Award the player, if the game was finished
                const selectedRoomId = this.roomService.getSelectedRoomId();
                if (selectedRoomId && this.roomService.anybodyWon() && this.roomService.isGameFinished()) {
                    const player = this.getActivePlayer();
                    if (player.isXpProcessed) { // If player has already received XP from the game - return
                        return of(null);
                    }

                    const userAction = this.isWinner(player.playerId) ? UserAction.WinGame : UserAction.LooseGame;

                    return forkJoin([
                        this.ratingService.addXp(player.userId, userAction),
                        this.firebaseService.update(
                            PlayerDto,
                            'players',
                            `${selectedRoomId}_${player.userId}`,
                            { isXpProcessed: true }
                        )
                    ]);
                } else {
                    return of(null);
                }
            }),
            takeUntil(this.destroy$)
        ).subscribe();
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public getMaxAllowedPlayers(game = this.selectedGame) {
        switch (game) {
            case Game.Nechto:
            default: return 12;
        }
    }

    public getMinAllowedPlayers(game = this.selectedGame) {
        switch (game) {
            case Game.Nechto:
            default: return this.ACTIVE_PLAYERS_NEEDED;
        }
    }

    public setActivePlayerId(playerId: number, game = this.selectedGame) {
        if (isUndefined(playerId) || isNil(game)) {
            throw new Error('Player ID or game not specified');
        }

        const selectedRoomId = this.roomService.getSelectedRoomId(game);
        if (isNil(selectedRoomId)) {
            throw new Error('Room ID not specified');
        }

        const role = !isNull(playerId) ? Role.Human : null;

        return this.firebaseService.update(
            PlayerDto,
            'players',
            `${selectedRoomId}_${this.userService.getCurrentUserId()}`,
            { playerId, role }
        );
    }

    public getActivePlayer(game = this.selectedGame) {
        if (isNil(game)) {
            throw new Error('Game not specified');
        }

        const selectedRoomId = this.roomService.getSelectedRoomId(game);
        if (isNil(selectedRoomId)) {
            console.warn('Room ID not specified');
            return null;
        }

        return this.roomService.getRoomMember(this.userService.getCurrentUserId(), selectedRoomId);
    }

    public getActivePlayerId(game = this.selectedGame) {
        const player = this.getActivePlayer(game);
        return player ? player.playerId : null;
    }

    public selectGame(game: Game) {
        if (isNil(game)) {
            throw new Error('Game not specified');
        }

        this.selectedGame = game;
        this.roomService.selectGame(game);
    }

    public getSelectedGame() {
        return this.selectedGame;
    }

    public startGame(roomId = this.roomService.getSelectedRoomId()) {
        if (!roomId) {
            throw new Error('Room ID not specified');
        }

        const selectedRoom = this.roomService.getRoom(roomId);
        const selectedGame = this.selectedGame;
        if (!selectedRoom || !selectedGame) {
            throw new Error('Room or Game not specified');
        }

        const playerComponents = this.getActivePlayerComponents();

        let startingPlayerId: number;
        if (selectedRoom.hasRandomStartingPlayer) {
            startingPlayerId = getRandomItem(playerComponents).playerId;
        } else {
            startingPlayerId = playerComponents[0].playerId;
        }

        const [{ deck, hands, table, borders }, luckyUserId] = this.cardHelpers.initAllCards(
            selectedGame,
            playerComponents,
            selectedRoom.hasCardsBasedOnQuantity
        );

        return forkJoin([
            this.firebaseService.set(
                GameDto,
                'games',
                selectedRoom.id,
                {
                    roomId: selectedRoom.id,
                    deck,
                    trash: [],
                    hands,
                    table,
                    borders,
                    currentStepPlayerId: startingPlayerId,
                    currentStepPhases: [StepPhase.TakeFromDeck],
                    authorId: this.userService.getCurrentUserId(),
                    direction: Direction.Clockwise
                }
            ),
            // Set selected player role to It
            this.firebaseService.update(
                PlayerDto,
                'players',
                `${selectedRoom.id}_${luckyUserId}`,
                { role: Role.It }
            ),
            // Remove players without selected places
            this.firebaseService.deleteQuery(
                'players',
                [{
                    field: 'roomId',
                    operator: '==',
                    value: selectedRoom.id
                }, {
                    field: 'playerId',
                    operator: '==',
                    value: null
                }]
            )
        ])
            .pipe(
                switchMap(() => {
                    return forkJoin([
                        this.roomService.setGameMode(selectedRoom.id, true),
                        this.roomService.setGameFinished(selectedRoom.id, false)
                    ]);
                })
            );
    }

    public endGame(
        roomId = this.roomService.getSelectedRoomId(),
        deleteData = true
    ) {
        if (!roomId) {
            throw new Error('Room ID not specified');
        }

        const finalObs$ = deleteData ? [
            this.firebaseService.deleteQuery(
                'players',
                [{
                    field: 'roomId',
                    operator: '==',
                    value: roomId
                }]
            )
        ] : [
                this.firebaseService.updateQuery(
                    PlayerDto,
                    'players',
                    [{
                        field: 'roomId',
                        operator: '==',
                        value: roomId
                    }],
                    {
                        role: Role.Human
                    }
                )
            ];

        return forkJoin([
            this.roomService.setGameMode(roomId, false),
            this.roomService.setGameFinished(roomId, false),
            ...finalObs$
        ])
            .pipe(
                switchMap(() => {
                    return forkJoin([
                        this.firebaseService.delete(GameDto, 'games', roomId),
                        this.gameInfoService.deleteStepInfo(roomId)
                    ]);
                }),
                tap(() => this.gameStopped$.next())
            );
    }

    public restartGame(roomId = this.roomService.getSelectedRoomId()) {
        if (!roomId) {
            throw new Error('Room ID not specified');
        }

        return this.endGame(roomId, false)
            .pipe(
                switchMap(() => this.startGame(roomId))
            );
    }

    public setPlayerComponents(players: NechtoPlayerComponent[]) {
        const sortedPlayers = [...players].sort((a, b) => a.playerId - b.playerId);
        setTimeout(() => this.playerComponentsUpdated$.next(sortedPlayers));
    }

    public setTableComponent(table: NechtoTableComponent) {
        this.tableComponentUpdated$.next(table);
    }

    public getPlayerComponents() {
        return this.playerComponents;
    }

    public getTableComponent() {
        return this.tableComponent;
    }

    public getActivePlayerComponents(ignoreBots = false, ignoreInactive = true) {
        return this.playerComponents.filter((item) => {
            return item.hasPlayer
                && (!ignoreInactive || !item.isInactive)
                && (!ignoreBots || !item.isBot);
        });
    }

    public getInactivePlayerComponents() {
        return this.playerComponents.filter((item) => !item.hasPlayer);
    }

    public getStreamingPlayerComponents() {
        return this.playerComponents.filter((item) => {
            return !item.isBot && (item.hasStream || item.hasBlockedStream) && !item.isInactive;
        });
    }

    public getInvalidStreamingPlayerComponents() {
        return this.getActivePlayerComponents().filter((item) => {
            return !item.isBot && !item.hasStream && !item.hasBlockedStream;
        });
    }

    public getActiveBotComponents() {
        return this.playerComponents.filter((item) => {
            return item.hasPlayer && item.isBot;
        });
    }

    public getPlayerComponent(playerId: number) {
        return this.playerComponents.find((item) => item.playerId === playerId);
    }

    public getActivePlayersCount() {
        return this.getActivePlayerComponents().length;
    }

    public isTakingStep(playerId: number, ignoreBots = false) {
        if (!this.roomService.isGameMode()) {
            return false;
        }

        const currentStepPlayerId = this.getCurrentStepPlayerId();
        const currentPlayerComponent = this.getPlayerComponent(currentStepPlayerId);

        if (!ignoreBots && this.roomService.isBotManager(this.userService.getCurrentUserId())) { // You are a bot manager - check for bots
            const isActivePlayerRequested = playerId === this.getActivePlayerId();

            if (isActivePlayerRequested) { // Combined check for current user
                if (currentPlayerComponent && currentPlayerComponent.isBot) {
                    return true;
                } else { // Not a bot, but self-check
                    return currentStepPlayerId === playerId;
                }
            } else { // Can be a bot
                if (playerId !== currentStepPlayerId) { // Not an active step player
                    return false;
                } else {
                    return currentPlayerComponent ? currentPlayerComponent.isBot : false;
                }
            }
        } else {
            return currentStepPlayerId === playerId;
        }
    }

    public isBotTakingStep() {
        const currentStepPlayerId = this.getCurrentStepPlayerId();

        if (!currentStepPlayerId) {
            return false;
        }

        const currentPlayerComponent = this.getPlayerComponent(currentStepPlayerId);
        return currentPlayerComponent.isBot;
    }

    public hasStepPhase(phase: StepPhase) {
        return this.currentStepPhases.includes(phase);
    }

    public hasStepPhases(...phases: StepPhase[]) {
        return phases.every((item) => this.currentStepPhases.includes(item));
    }

    public hasAnyOfStepPhases(...phases: StepPhase[]) {
        return this.currentStepPhases.some((item) => phases.includes(item));
    }

    public hadStepPhase(phase: StepPhase) {
        return this.previousStepPhases.includes(phase);
    }

    public hadStepPhases(...phases: StepPhase[]) {
        return phases.every((item) => this.previousStepPhases.includes(item));
    }

    public hadAnyOfStepPhases(...phases: StepPhase[]) {
        return this.previousStepPhases.some((item) => phases.includes(item));
    }

    // TODO: add recursion feature to find further neighbors
    public getPreviousPlayer(relativeToPlayerId?: number, ignoreInactive = false) {
        relativeToPlayerId = relativeToPlayerId || this.getCurrentStepPlayerId();

        const activePlayers = this.getActivePlayerComponents(false, ignoreInactive);

        const playerIds = activePlayers.map((item) => item.playerId);
        const currentPlayerIndex = playerIds.findIndex((item) => item === relativeToPlayerId);

        let previousPlayerId: number;
        if (this.currentGame.direction === Direction.Clockwise) {
            previousPlayerId = playerIds[currentPlayerIndex - 1] || playerIds[playerIds.length - 1];
        } else {
            previousPlayerId = playerIds[currentPlayerIndex + 1] || playerIds[0];
        }

        return activePlayers.find((item) => item.playerId === previousPlayerId);
    }

    public getNextPlayer(relativeToPlayerId?: number, ignoreInactive = true) {
        relativeToPlayerId = relativeToPlayerId || this.getCurrentStepPlayerId();

        const activePlayers = this.getActivePlayerComponents(false, ignoreInactive);

        const playerIds = activePlayers.map((item) => item.playerId);
        const currentPlayerIndex = playerIds.findIndex((item) => item === relativeToPlayerId);

        let nextPlayerId: number;
        if (this.currentGame.direction === Direction.Clockwise) {
            nextPlayerId = playerIds[currentPlayerIndex + 1] || playerIds[0];
        } else {
            nextPlayerId = playerIds[currentPlayerIndex - 1] || playerIds[playerIds.length - 1];
        }

        return activePlayers.find((item) => item.playerId === nextPlayerId);
    }

    public getTablePartId(cardId: string) {
        if (this.hasCurrentGame) {
            const playerIdKey = Object.keys(this.currentGameTable)
                .find((playerId) => {
                    const id = parseInt(playerId, null);
                    return this.currentGameTable[id].some((item) => item.id === cardId);
                });

            return playerIdKey ? parseInt(playerIdKey, null) : null;
        } else {
            return null;
        }
    }

    public getHandPartId(cardId: string) {
        if (this.hasCurrentGame) {
            const playerIdKey = Object.keys(this.currentGameHands)
                .find((playerId) => {
                    const id = parseInt(playerId, null);
                    return this.currentGameHands[id].some((item) => item.id === cardId);
                });

            return playerIdKey ? parseInt(playerIdKey, null) : null;
        } else {
            return null;
        }
    }

    public getBorderPartId(cardId: string) {
        if (this.hasCurrentGame) {
            const playerIdKey = Object.keys(this.currentGameBorders)
                .find((playerId) => {
                    const id = parseInt(playerId, null);
                    return this.currentGameBorders[id].some((item) => item.id === cardId);
                });

            return playerIdKey ? parseInt(playerIdKey, null) : null;
        } else {
            return null;
        }
    }

    public getActiveRequestedCard() {
        return this.getActiveCard();
    }

    public getActiveEventCard() {
        return this.getActiveCard(NechtoCardType.Event);
    }

    public getActivePanicCard() {
        return this.getActiveCard(NechtoCardType.Panic);
    }

    public getActiveRequester() {
        return this.getRequester();
    }

    public getActiveEventRequester() {
        return this.getRequester(NechtoCardType.Event);
    }

    public getActivePanicRequester() {
        return this.getRequester(NechtoCardType.Panic);
    }

    public canExchange(
        otherPlayerId: number,
        ignoreQuarantines = false,
        ignoreLockedDoors = false,
        ignoreSelfQuarantine = false) {
        if (!otherPlayerId) {
            console.warn('Other Player ID not specified');
            return false;
        }

        const activePlayerId = this.getCurrentStepPlayerId();

        return this.canExchangeBoth(activePlayerId, otherPlayerId, ignoreQuarantines, ignoreLockedDoors, ignoreSelfQuarantine);
    }

    public canExchangeBoth(
        firstPlayerId: number,
        secondPlayerId: number,
        ignoreQuarantines = false,
        ignoreLockedDoors = false,
        ignoreFirstPlayerSelfQuarantine = false) {
        if (!firstPlayerId || !secondPlayerId) {
            console.warn('First or Second Player ID not specified');
            return false;
        }

        return !this.isInactive(firstPlayerId)
            && !this.isInactive(secondPlayerId)
            && (
                ignoreQuarantines
                || (
                    (
                        ignoreFirstPlayerSelfQuarantine
                        || !this.hasQuarantine(firstPlayerId)
                    )
                    && !this.hasQuarantine(secondPlayerId)
                )
            )
            && (
                ignoreLockedDoors
                || (!this.hasLockedDoor(firstPlayerId, secondPlayerId) && !this.hasLockedDoor(secondPlayerId, firstPlayerId))
            );
    }

    public hasQuarantine(playerId: number) {
        if (!playerId) {
            console.warn('Player ID not specified');
            return false;
        }

        if (!this.currentGameTable[playerId]) {
            return false;
        }

        return this.currentGameTable[playerId].some((item) => {
            return item.action === NechtoCardAction.Event_Obstacle_Quarantine;
        });
    }

    public hasLockedDoor(playerId: number, otherPlayerId: number) {
        if (!playerId || !otherPlayerId) {
            console.warn('Player ID or Other Player ID not specified');
            return false;
        }

        if (!this.currentGameBorders[playerId]) {
            return false;
        }

        if (playerId === otherPlayerId) {
            return this.currentGameBorders[playerId].length > 0;
        } else {
            return this.currentGameBorders[playerId].some((item) => {
                return item.blockFrom === otherPlayerId;
            });
        }
    }

    public hasAnyLockedDoor(playerId: number) {
        if (!playerId) {
            console.warn('Player ID not specified');
            return false;
        }

        if (!this.currentGameBorders[playerId]) {
            return false;
        }

        return this.currentGameBorders[playerId].some((item) => {
            return item.action === NechtoCardAction.Event_Obstacle_LockedDoor;
        });
    }

    public getLockedDoors(playerId: number) {
        if (!playerId) {
            console.warn('Player ID not specified');
            return [];
        }

        return this.currentGameBorders[playerId].filter((item) => {
            return item.action === NechtoCardAction.Event_Obstacle_LockedDoor;
        });
    }

    public isIt(playerId?: number) {
        const player = playerId ?
            this.roomService.getRoomMemberByPlayerId(playerId, this.roomService.getSelectedRoomId()) : this.getActivePlayer();

        if (!player) {
            return false;
        }

        return player.role === Role.It;
    }

    public isInfected(playerId?: number) {
        const player = playerId ?
            this.roomService.getRoomMemberByPlayerId(playerId, this.roomService.getSelectedRoomId()) : this.getActivePlayer();

        if (!player) {
            return false;
        }

        return player.role === Role.Infected;
    }

    public isHuman(playerId?: number) {
        const player = playerId ?
            this.roomService.getRoomMemberByPlayerId(playerId, this.roomService.getSelectedRoomId()) : this.getActivePlayer();

        if (!player) {
            return false;
        }

        return player.role === Role.Human;
    }

    public wasHuman(playerId?: number) {
        const player = playerId ?
            this.roomService.getRoomMemberByPlayerId(playerId, this.roomService.getSelectedRoomId()) : this.getActivePlayer();

        if (!player) {
            return false;
        }

        return player.role === Role.Inactive && player.previousRole === Role.Human;
    }

    public isInactive(playerId?: number) {
        const player = playerId ?
            this.roomService.getRoomMemberByPlayerId(playerId, this.roomService.getSelectedRoomId()) : this.getActivePlayer();

        if (!player) {
            return false;
        }

        return player.role === Role.Inactive;
    }

    public isWinner(playerId = this.getActivePlayerId()) {
        if (!playerId) {
            return false;
        }

        if (this.roomService.humansWon()) {
            return this.isHuman(playerId) || this.wasHuman(playerId);
        } else if (this.roomService.itWon()) {
            return this.isIt(playerId) || this.isInfected(playerId) || !this.wasHuman(playerId);
        } else {
            return false;
        }
    }

    public getTable(playerId = this.getCurrentStepPlayerId()) {
        return this.currentGameTable[playerId] || [];
    }

    public getHand(playerId = this.getCurrentStepPlayerId()) {
        return this.currentGameHands[playerId] || [];
    }

    public swapPlayers(firstPlayerId: number, secondPlayerId: number) {
        const selectedRoomId = this.roomService.getSelectedRoomId();

        const firstUserId = this.roomService.getRoomMemberByPlayerId(
            firstPlayerId,
            this.roomService.getSelectedRoomId()
        ).userId;
        const secondUserId = this.roomService.getRoomMemberByPlayerId(
            secondPlayerId,
            selectedRoomId
        ).userId;

        console.log(`Swapping 2 players: #${firstPlayerId} with #${secondPlayerId}`);

        return [
            this.firebaseService.update(
                PlayerDto,
                'players',
                `${selectedRoomId}_${firstUserId}`,
                { playerId: secondPlayerId }
            ),
            this.firebaseService.update(
                PlayerDto,
                'players',
                `${selectedRoomId}_${secondUserId}`,
                { playerId: firstPlayerId }
            )
        ];
    }

    public getCurrentStepPlayerId() {
        return this.currentGame.currentStepPlayerId;
    }

    public getCurrentStepPlayerComponent() {
        return this.getPlayerComponent(this.getCurrentStepPlayerId());
    }

    private getActiveCard(type?: NechtoCardType) {
        if (this.hasCurrentGame) {
            let requestedCard: GenericCard = null;
            Object.keys(this.currentGameTable).forEach((playerId) => {
                const id = parseInt(playerId, null);

                if (!requestedCard) {
                    requestedCard = this.currentGameTable[id].find((item) => {
                        switch (type) {
                            case NechtoCardType.Event: return !!item.eventRequester;
                            case NechtoCardType.Panic: return !!item.panicRequester;
                            default: return !!item.requester;
                        }
                    }) || null;
                }
            });

            return requestedCard;
        } else {
            return null;
        }
    }

    private getRequester(type?: NechtoCardType) {
        if (this.hasCurrentGame) {
            const requestedCard = this.getActiveCard(type);
            if (!requestedCard) {
                return null;
            }

            let requesterId: number;
            switch (type) {
                case NechtoCardType.Event:
                    requesterId = requestedCard.eventRequester;
                    break;
                case NechtoCardType.Panic:
                    requesterId = requestedCard.panicRequester;
                    break;
                default:
                    requesterId = requestedCard.requester;
                    break;
            }

            return this.getActivePlayerComponents().find((item) => item.playerId === requesterId) || null;
        } else {
            return null;
        }
    }

    private navigateToLobby() {
        this.router.navigate(['/games', this.selectedGame.toLowerCase(), 'lobby']);
    }
}
