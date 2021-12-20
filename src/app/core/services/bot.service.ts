import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, timeout, switchMap } from 'rxjs/operators';

import { GameRoomDto } from '../../models/dtos/game-room-dto.model';
import { PlayerDto } from '../../models/dtos/player-dto.model';
import { GameAction } from '../../models/enums/game-action.enum';
import { Role } from '../../models/enums/role.enum';
import { StepPhase } from '../../models/enums/step-phase.enum';
import {
    NechtoCardComponent,
} from '../../modules/games/modules/nechto/components/nechto-card/nechto-card.component';
import { getRandomItem, getRandomMapItem } from '../helpers/array.helpers';
import { isUndefined } from '../helpers/type.helpers';
import { CardService } from './card.service';
import { FirebaseService } from './firebase.service';
import { GameService } from './game.service';
import { HttpService } from './http.service';
import { RoomService } from './room.service';
import { UserService } from './user.service';
import { Gender } from '../../models/enums/gender.enum';

@Injectable({
    providedIn: 'root'
})
export class BotService {
    public isProcessingBotStep = false;
    public botProcessingInterval = 10000;
    private bots: PlayerDto[] = [];
    private botRecords = new Map<string, Gender>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly httpService: HttpService,
        private readonly gameService: GameService,
        private readonly cardService: CardService,
        private readonly roomService: RoomService,
        private readonly userService: UserService
    ) {
        this.httpService.getPlain('/assets/txt/bots.csv')
            .pipe(
                map((data) => {
                    data.split('\n').map((item) => {
                        const botRecord = item.trim().split(',');
                        this.botRecords.set(botRecord[0], botRecord[1] as Gender);
                    });
                })
            )
            .subscribe();

        this.roomService.roomMembers$
            .pipe(
                map((players) => {
                    this.bots = players.filter((item) => item.isBot);
                })
            )
            .subscribe();

        this.gameService.gameStopped$
            .pipe(
                map(() => this.isProcessingBotStep = false)
            )
            .subscribe();
    }

    public getBot(roomId, playerId: number) {
        return this.bots.find((item) => item.roomId === roomId && item.playerId === playerId);
    }

    public addBot(roomId: string, playerId: number) {
        const botId = `BOT_${this.firebaseService.generateId()}`;
        const botRecord = this.getRandomBotRecord();

        return this.firebaseService.set(
            PlayerDto,
            'players',
            `${roomId}_${botId}`,
            {
                roomId,
                playerId,
                role: Role.Human,
                userId: botId,
                botName: botRecord[0],
                botGender: botRecord[1]
            }
        );
    }

    public removeBot(roomId: string, playerId: number) {
        const bot = this.bots.find((item) => item.roomId === roomId && item.playerId === playerId);
        if (!bot) {
            console.warn(`Cannot remove the bot at #${playerId} place - bot is missing`);
            return of();
        }

        return this.firebaseService.delete(PlayerDto, 'players', `${roomId}_${bot.userId}`);
    }

    public removeBots(roomId: string): Observable<any> {
        const botIds = this.bots.map((item) => item.playerId);
        if (!botIds.length) {
            console.warn(`Cannot remove bots in the room #${roomId} - none of them are present`);
            return of(true);
        }

        console.warn(`Removing all bots in room #${roomId}`);
        return this.firebaseService.deleteQuery(
            'players',
            [{
                field: 'roomId',
                operator: '==',
                value: roomId
            }, {
                field: 'playerId',
                operator: 'in',
                value: botIds
            }]
        );
    }

    public getRandomBotRecord() {
        const randomRecord = getRandomMapItem(this.botRecords);
        this.botRecords.delete(randomRecord[0]);
        return randomRecord;
    }

    public processBotStep() {
        console.log('>>> BOT: Processing step');

        this.isProcessingBotStep = true;

        let res$: Observable<any>;

        // Initialize all component variables for further processing
        const tableComponent = this.gameService.getTableComponent();
        const playerComponents = this.gameService.getActivePlayerComponents();

        const tableCardComponents: NechtoCardComponent[] = [];
        if (tableComponent) {
            tableComponent.cardComponents.forEach((item) => tableCardComponents.push(item));
        }

        const handCardComponents: NechtoCardComponent[] = [];
        if (playerComponents) {
            playerComponents.forEach((playerComponent) => {
                playerComponent.cardComponents.forEach((item) => handCardComponents.push(item));
            });
        }

        // Generate list of first available cards for each action
        const firstTakeableHandCardComponent = handCardComponents.find((item) => item.canTake);
        const firstTakeableTableCardComponent = tableCardComponents.find((item) => item.canTake);
        const firstPlayableHandCardComponent = handCardComponents.find((item) => item.canPlay);
        const firstPlayableTableCardComponent = tableCardComponents.find((item) => item.canPlay);
        const firstDroppableHandCardComponent = handCardComponents.find((item) => item.canDrop);
        const firstDroppableTableCardComponent = tableCardComponents.find((item) => item.canDrop);
        const firstGiveableHandCardComponent = handCardComponents.find((item) => item.canGive);
        const firstGiveableTableCardComponent = tableCardComponents.find((item) => item.canGive);

        const activePlayerId = this.gameService.getActivePlayerId();

        if (this.cardService.canRefillDeck()) {
            res$ = this.cardService.refillDeck();
        } else {
            const availableActions = new Map<GameAction, any[]>();

            if (this.gameService.hasAnyOfStepPhases(StepPhase.TakeFromDeck, StepPhase.FulfillHandFromDeck)
                && firstTakeableTableCardComponent) {
                availableActions.set(GameAction.TakeDeckCard, [firstTakeableTableCardComponent.card.id]);
            }
            if (this.gameService.hasStepPhase(StepPhase.PickFromHand) && firstTakeableHandCardComponent) {
                availableActions.set(GameAction.TakeHandCard, [firstTakeableHandCardComponent.card.id]);
            }
            if (this.gameService.hasStepPhase(StepPhase.PlayFromTable) && firstPlayableTableCardComponent) {
                let receivingPlayer: number;
                if (firstPlayableTableCardComponent.filteredReceivingPlayers.length > 0) {
                    receivingPlayer = firstPlayableTableCardComponent.filteredReceivingPlayers[0].playerId;
                }

                availableActions.set(GameAction.PlayTableCard, [firstPlayableTableCardComponent.card.id, receivingPlayer]);
            }
            if (this.gameService.hasAnyOfStepPhases(StepPhase.PlayFromHand, StepPhase.DefenceFromHand) && firstPlayableHandCardComponent) {
                let receivingPlayer: number;
                if (firstPlayableHandCardComponent.filteredReceivingPlayers.length > 0) {
                    receivingPlayer = firstPlayableHandCardComponent.filteredReceivingPlayers[0].playerId;
                }

                availableActions.set(GameAction.PlayHandCard, [firstPlayableHandCardComponent.card.id, receivingPlayer]);
            }
            if (this.gameService.hasStepPhase(StepPhase.DropFromTable) && firstDroppableTableCardComponent) {
                availableActions.set(GameAction.DropTableCard, [firstDroppableTableCardComponent.card.id]);
            }
            if (this.gameService.hasStepPhase(StepPhase.DropFromHand) && firstDroppableHandCardComponent) {
                availableActions.set(GameAction.DropHandCard, [firstDroppableHandCardComponent.card.id]);
            }
            if (this.gameService.hasAnyOfStepPhases(
                StepPhase.GiveToPlayer,
                StepPhase.GiveToNextPlayer,
                StepPhase.GiveToPreviousPlayer,
                StepPhase.GiveToSpecificPlayer
            ) && firstGiveableHandCardComponent) {
                let receivingPlayer: number;
                if (firstGiveableHandCardComponent.filteredReceivingPlayers.length > 0) {
                    receivingPlayer = firstGiveableHandCardComponent.filteredReceivingPlayers[0].playerId;
                }

                availableActions.set(GameAction.GiveHandCard, [firstGiveableHandCardComponent.card.id, receivingPlayer]);
            }
            if (this.gameService.hasStepPhase(StepPhase.ReturnToPlayer) && firstGiveableTableCardComponent) {
                let receivingPlayer: number;
                if (firstGiveableTableCardComponent.filteredReceivingPlayers.length > 0) {
                    receivingPlayer = firstGiveableTableCardComponent.filteredReceivingPlayers[0].playerId;
                }

                availableActions.set(GameAction.GiveTableCard, [firstGiveableTableCardComponent.card.id, receivingPlayer]);
            }
            if (this.gameService.hasStepPhase(StepPhase.ShowFromHand)) {
                if (this.gameService.isHuman(activePlayerId)) {
                    availableActions.set(GameAction.ShowCards, []);
                } else {
                    availableActions.set(GameAction.SkipShowingCards, []);
                }
            }
            if (this.gameService.hasStepPhase(StepPhase.AcceptRequest)) {
                availableActions.set(GameAction.AcceptRequest, []);
            }

            // TODO: refactor
            const action = getRandomMapItem(availableActions);
            res$ = (this.cardService[action[0]] as any)(...action[1]);
        }

        return res$.pipe(
            finalize(() => this.isProcessingBotStep = false),
            timeout(this.botProcessingInterval * 2),
            catchError(() => {
                this.isProcessingBotStep = false;
                return throwError('Request timed out');
            })
        );
    }

    public processBotManagement(
        roomId = this.roomService.getSelectedRoomId(),
        forceAnotherManager = false,
        canRemoveBots = true
    ): Observable<any> {
        if (!roomId) {
            console.warn('Room ID not specified');
            return of(true);
        }

        const botManagerId = this.roomService.getBotManagerId();
        // Current bot manager is set for the room - no actions needed
        if (botManagerId && (!forceAnotherManager || botManagerId !== this.userService.getCurrentUserId())) {
            return of(true);
        }

        const allRoomMembers = this.roomService.getRoomMembers(roomId);
        const activePlayers = allRoomMembers
            .filter((item) => !item.isBot)
            .filter((item) => !forceAnotherManager || item.playerId !== this.gameService.getActivePlayerId());

        if (activePlayers.length) { // Available managers left - swap to the first one
            return this.setBotManager(activePlayers[0].userId, roomId);
        } else { // Clear bot manager & remove all bots (if such exist)
            return forkJoin([
                this.setBotManager(null, roomId),
                canRemoveBots ? this.removeBots(roomId) : of(true)
            ]);
        }
    }

    public setBotManager(userId: string, roomId = this.roomService.getSelectedRoomId()) {
        if (isUndefined(userId) || !roomId) {
            throw new Error('Manager ID or Room ID not specified');
        }

        if (this.roomService.isBotManager(userId, roomId)) {
            console.warn('Same Manager ID already exists');
            return of(this.roomService.getSelectedRoom());
        }

        console.warn(`Setting Bot Manager ID to ${userId} in room #${roomId}`);
        return this.firebaseService.update(GameRoomDto, 'rooms', roomId, { botManagerId: userId });
    }
}
