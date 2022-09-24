import { Injectable } from '@angular/core';
import { EMPTY, forkJoin, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { GameDto } from '../../models/dtos/game-dto.model';
import { PlayerDto } from '../../models/dtos/player-dto.model';
import { StepInfoDto } from '../../models/dtos/step-info-dto.model';
import { Direction } from '../../models/enums/direction.enum';
import { Game } from '../../models/enums/game.enum';
import { NechtoCardAction } from '../../models/enums/nechto-card-action.enum';
import { NechtoCardSubType } from '../../models/enums/nechto-card-sub-type.enum';
import { NechtoCardType } from '../../models/enums/nechto-card-type.enum';
import { Role } from '../../models/enums/role.enum';
import { StepPhase, TakeStepPhase } from '../../models/enums/step-phase.enum';
import { FulfillmentCheck } from '../../models/interfaces/fulfillment-check.interface';
import { LockedDoorOption } from '../../models/interfaces/locked-door-option.interface';
import { QuarantineCheck } from '../../models/interfaces/quarantine-check.interface';
import { NechtoCard } from '../../models/nechto-card.model';
import { reorderArray, shuffleArray } from '../helpers/array.helpers';
import { isNil } from '../helpers/type.helpers';
import { FirebaseService } from './firebase.service';
import { GameInfoService } from './game-info.service';
import { GameService } from './game.service';
import { RoomService } from './room.service';

@Injectable({
    providedIn: 'root'
})
export class CardService {
    public get isTakingStep() {
        return this.gameService.isTakingStep(this.gameService.getActivePlayerId());
    }
    public readonly MAX_HAND_CARDS = 4;

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly gameService: GameService,
        private readonly roomService: RoomService,
        private readonly gameInfoService: GameInfoService
    ) { }

    public canDrop() {
        return this.isTakingStep
            && !this.roomService.isGameFinished()
            && this.gameService.hasAnyOfStepPhases(StepPhase.DropFromHand, StepPhase.DropFromTable);
    }

    public canTake(stepPhases: TakeStepPhase[]) {
        return this.isTakingStep
            && !this.roomService.isGameFinished()
            && this.gameService.hasAnyOfStepPhases(...stepPhases);
    }

    public canPlay() {
        return this.isTakingStep
            && !this.roomService.isGameFinished()
            && this.gameService.hasAnyOfStepPhases(
                StepPhase.PlayFromHand,
                StepPhase.DefenceFromHand,
                StepPhase.ShowFromHand,
                StepPhase.PlayFromTable
            );
    }

    public canGive() {
        return this.isTakingStep
            && !this.roomService.isGameFinished()
            && this.gameService.hasAnyOfStepPhases(
                StepPhase.GiveToNextPlayer,
                StepPhase.GiveToPreviousPlayer,
                StepPhase.GiveToPlayer,
                StepPhase.GiveToSpecificPlayer,
                StepPhase.ReturnToPlayer
            );
    }

    public canRefillDeck() {
        return this.isTakingStep
            && !this.roomService.isGameFinished()
            && !this.gameService.currentGameDeck.length
            && this.gameService.currentGameTrash.length;
    }

    public takeDeckCard(cardId: string) {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return EMPTY;
        }

        const game = this.gameService.currentGame;
        const card = game.deck.find((item) => item.id === cardId);
        if (isNil(card)) {
            console.warn('Missing card');
            return EMPTY;
        }

        const activePlayerId = this.gameService.getCurrentStepPlayerId();
        const selectedRoomId = this.roomService.getSelectedRoomId();

        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasAnyOfStepPhases(StepPhase.TakeFromDeck, StepPhase.FulfillHandFromDeck)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                game.deck = game.deck.filter((item) => item.id !== cardId);

                let nextStepPlayerId: number;
                const nextPlayerId = this.gameService.getNextPlayer().playerId;
                let maxHandCards = this.MAX_HAND_CARDS;
                const activePanicCard = this.gameService.getActivePanicCard();
                const activeEventCard = this.gameService.getActiveEventCard();
                let reservedStepPhases = game.reservedStepPhases;
                let reservedStepPlayerId = game.reservedStepPlayerId;

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                if (this.gameService.hasStepPhase(StepPhase.TakeFromDeck)) { // Taking card from the deck
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.TakeFromDeck,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    nextStepPlayerId = activePlayerId;

                    if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) { // Taking is forced by panic card
                    } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) { // Taking is forced by event card
                        // We need extra card slot(s) in hand for taking logic to work
                        switch (activeEventCard.action) {
                            case NechtoCardAction.Event_Action_Persistence:
                                maxHandCards += 3;
                                break;

                            default:
                                break;
                        }
                    }

                    if (card.type === NechtoCardType.Event) { // Event card received
                        // For the forced card taking - we do it initially before any checks
                        if (this.gameService.hasAnyOfStepPhases(StepPhase.ProcessPanic, StepPhase.ProcessEvent)) {
                            game.hands[activePlayerId].push({ ...card, hidden: false });
                        }

                        if (game.hands[activePlayerId].length < maxHandCards) { // Not enough hand cards - continue to pick more
                            nextStepPhases = [StepPhase.TakeFromDeck];

                            if (this.gameService.hasAnyOfStepPhases(StepPhase.ProcessPanic, StepPhase.ProcessEvent)) {
                                if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                                    nextStepPhases.push(StepPhase.ProcessPanic);
                                } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) {
                                    nextStepPhases.push(StepPhase.ProcessEvent);
                                }
                            } else {
                                // For regular taking, we add a card at the end
                                game.hands[activePlayerId].push({ ...card, hidden: false });
                            }
                        } else { // Proceed to next phase
                            if (!this.gameService.hasAnyOfStepPhases(StepPhase.ProcessPanic, StepPhase.ProcessEvent)) {
                                nextStepPhases = [StepPhase.DropFromHand, StepPhase.PlayFromHand];

                                if (this.gameService.hasQuarantine(activePlayerId)) { // Player has a quarantine - process it
                                    const quarantineCheck = this.processQuarantine(activePlayerId);
                                    game.table = quarantineCheck.table;
                                    game.trash = quarantineCheck.trash;

                                    const hasAxeCard = game.hands[activePlayerId].some((item) => {
                                        return item.action === NechtoCardAction.Event_Action_Axe;
                                    });

                                    // Re-check once again. If player is still on a quarantine and
                                    // does not have any 'Axe' card - don't allow playing cards
                                    if (this.gameService.hasQuarantine(activePlayerId) && !hasAxeCard) {
                                        nextStepPhases = [StepPhase.DropFromHand];
                                    }
                                }

                                // For regular taking, we add a card at the end
                                game.hands[activePlayerId].push({ ...card, hidden: false });
                            } else if (this.gameService.hasAnyOfStepPhases(StepPhase.ProcessPanic)) {
                                switch (activePanicCard.action) {
                                    case NechtoCardAction.Panic_BlindDate:
                                        // Trash the panic card, as it has been processed
                                        game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                            if (item.id === activePanicCard.id) {
                                                game.trash.unshift({ ...item, hidden: true });
                                                return false;
                                            } else {
                                                return true;
                                            }
                                        });

                                        const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                        nextStepPhases = fulfillmentCheck.nextStepPhases;
                                        nextStepPlayerId = fulfillmentCheck.nextPlayerId;

                                        break;

                                    default:
                                        nextStepPhases = [StepPhase.ProcessPanic];
                                        break;
                                }
                            } else if (this.gameService.hasAnyOfStepPhases(StepPhase.ProcessEvent)) {
                                switch (activeEventCard.action) {
                                    case NechtoCardAction.Event_Action_Persistence:
                                        nextStepPhases = [StepPhase.DropFromHand, StepPhase.ProcessEvent];
                                        break;

                                    default:
                                        nextStepPhases = [StepPhase.ProcessEvent];
                                        break;
                                }
                            }
                        }
                    } else { // Panic card received
                        // Not enough hand cards - trash panic card and continue to pick more
                        if (game.hands[activePlayerId].length < maxHandCards) {
                            nextStepPhases = [StepPhase.TakeFromDeck];

                            if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                                nextStepPhases.push(StepPhase.ProcessPanic);
                            } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) {
                                nextStepPhases.push(StepPhase.ProcessEvent);
                            }

                            game.trash.unshift({ ...card, hidden: true });
                        } else { // Proceed to next phase by playing the panic card
                            const quarantineCheck = this.processQuarantine(activePlayerId);
                            game.table = quarantineCheck.table;
                            game.trash = quarantineCheck.trash;

                            switch (card.action) {
                                case NechtoCardAction.Panic_OldRopes:
                                case NechtoCardAction.Panic_BetweenUs:
                                case NechtoCardAction.Panic_IsItParty:
                                case NechtoCardAction.Panic_Oops:
                                case NechtoCardAction.Panic_ThreeFour:
                                    nextStepPhases = [StepPhase.PlayFromTable];
                                    break;
                                case NechtoCardAction.Panic_OneTwo:
                                    const thirdPreviousPlayerId = this.gameService.getPreviousPlayer(
                                        this.gameService.getPreviousPlayer(
                                            this.gameService.getPreviousPlayer(activePlayerId).playerId
                                        ).playerId
                                    ).playerId;
                                    const thirdNextPlayerId = this.gameService.getNextPlayer(
                                        this.gameService.getNextPlayer(
                                            this.gameService.getNextPlayer(activePlayerId).playerId
                                        ).playerId
                                    ).playerId;

                                    if (!this.gameService.hasQuarantine(thirdPreviousPlayerId)
                                        || !this.gameService.hasQuarantine(thirdNextPlayerId)) {
                                        nextStepPhases = [StepPhase.PlayFromTable];
                                    } else {
                                        nextStepPhases = [StepPhase.DropFromTable];
                                    }
                                    break;
                                case NechtoCardAction.Panic_GoAway:
                                    const availablePlayers = this.gameService.getActivePlayerComponents()
                                        .filter((item) => {
                                            return item.playerId !== activePlayerId && !this.gameService.hasQuarantine(item.playerId);
                                        });
                                    if (availablePlayers.length) {
                                        nextStepPhases = [StepPhase.PlayFromTable];
                                    } else {
                                        nextStepPhases = [StepPhase.DropFromTable];
                                    }
                                    break;
                                case NechtoCardAction.Panic_Friends:
                                    nextStepPhases = [StepPhase.GiveToPlayer];
                                    break;
                                case NechtoCardAction.Panic_BlindDate:
                                    nextStepPhases = [StepPhase.DropFromHand];
                                    break;
                                case NechtoCardAction.Panic_ChainReaction:
                                    card.panicRequester = activePlayerId;
                                    nextStepPhases = [StepPhase.GiveToNextPlayer];
                                    break;
                                case NechtoCardAction.Panic_ConfessionTime:
                                    card.panicRequester = activePlayerId;
                                    nextStepPhases = [StepPhase.ShowFromHand];
                                    break;
                                case NechtoCardAction.Panic_Forgetfulness:
                                    nextStepPhases = [StepPhase.DropFromHand];
                                    break;
                                default:
                                    nextStepPhases = [];
                                    break;
                            }

                            nextStepPhases.push(StepPhase.ProcessPanic);

                            game.table[activePlayerId].push({ ...card, hidden: false, panicRequester: activePlayerId });
                        }
                    }
                } else if (this.gameService.hasStepPhase(StepPhase.FulfillHandFromDeck)) { // Taking extra cards from the deck
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.FulfillHandFromDeck,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    if (card.type === NechtoCardType.Event) { // Event card received - regular workflow
                        game.hands[activePlayerId].push({ ...card, hidden: false });

                        const fulfillmentCheck = this.processHandFulfillment(activePlayerId);

                        if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) { // Fullfilment is caused by panic card
                            // Enough hand cards
                            if (game.hands[activePlayerId].length === maxHandCards && this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;

                                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                    if (item.type === NechtoCardType.Panic) {
                                        game.trash.unshift({ ...item, hidden: true });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });

                                const reservedDataResult = this.processReservedData(nextStepPhases, nextStepPlayerId);
                                nextStepPhases = reservedDataResult.currentStepPhases;
                                nextStepPlayerId = reservedDataResult.currentStepPlayerId;
                                reservedStepPhases = reservedDataResult.reservedStepPhases;
                                reservedStepPlayerId = reservedDataResult.reservedStepPlayerId;
                            } else { // Not enough hand cards
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;

                                nextStepPhases.push(StepPhase.ProcessPanic);
                            }
                        } else { // Regular fullfilment
                            nextStepPhases = fulfillmentCheck.nextStepPhases;
                            nextStepPlayerId = fulfillmentCheck.nextPlayerId;

                            if (game.hands[activePlayerId].length === maxHandCards) { // Enough hand cards
                                const reservedDataResult = this.processReservedData(nextStepPhases, nextStepPlayerId);
                                nextStepPhases = reservedDataResult.currentStepPhases;
                                nextStepPlayerId = reservedDataResult.currentStepPlayerId;
                                reservedStepPhases = reservedDataResult.reservedStepPhases;
                                reservedStepPlayerId = reservedDataResult.reservedStepPlayerId;
                            }
                        }
                    } else { // Panic card received
                        // Not enough hand cards - trash panic card and continue to pick more
                        if (game.hands[activePlayerId].length < maxHandCards) {
                            nextStepPhases = [StepPhase.FulfillHandFromDeck];
                            nextStepPlayerId = activePlayerId;

                            game.trash.unshift({ ...card, hidden: true });

                            if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                                nextStepPhases.push(StepPhase.ProcessPanic);
                            }
                        }
                    }
                }

                return this.updateGameData(selectedRoomId, {
                    deck: game.deck,
                    hands: game.hands,
                    table: game.table,
                    trash: game.trash,
                    currentStepPhases: nextStepPhases,
                    previousStepPhases: this.gameService.currentStepPhases,
                    currentStepPlayerId: nextStepPlayerId,
                    previousStepPlayerId: activePlayerId,
                    lastCard: card,
                    reservedStepPhases,
                    reservedStepPlayerId
                });
        }
    }

    public takeHandCard(cardId: string) {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return EMPTY;
        }

        const game = this.gameService.currentGame;
        const card = game.hands[this.gameService.getHandPartId(cardId)].find((item) => item.id === cardId);
        if (isNil(card)) {
            console.warn('Missing card');
            return EMPTY;
        }

        const activePlayerId = this.gameService.getCurrentStepPlayerId();
        const selectedRoomId = this.roomService.getSelectedRoomId();

        let nextStepPhases: StepPhase[] = [];
        let nextStepPlayerId: number;

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.PickFromHand)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        cardAction: card.action,
                        stepPhase: StepPhase.PickFromHand,
                        processedAt: new Date()
                    })
                ).subscribe();

                // Picking a card usually means taking one selected card from another players' hand for further processing
                switch (game.lastCard.action) {
                    case NechtoCardAction.Event_Action_Suspicion:
                        // Check the selected card of another player
                        card.sharedWithPlayerId = activePlayerId;

                        nextStepPhases = [StepPhase.DropFromTable];
                        nextStepPlayerId = activePlayerId;
                        break;

                    default:
                        break;
                }

                return this.updateGameData(selectedRoomId, {
                    hands: game.hands,
                    currentStepPhases: nextStepPhases,
                    previousStepPhases: this.gameService.currentStepPhases,
                    currentStepPlayerId: nextStepPlayerId,
                    previousStepPlayerId: activePlayerId,
                    lastCard: card
                });
        }
    }

    public playHandCard(cardId: string, otherPlayerId?: number): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasAnyOfStepPhases(StepPhase.PlayFromHand, StepPhase.DefenceFromHand)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                const card = game.hands[activePlayerId].find((item) => item.id === cardId);
                if (isNil(card)) {
                    throw new Error('Missing card');
                }

                let nextStepPlayerId: number;
                const res$: Observable<any>[] = [];

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                let otherPlayerUsername: string;
                if (otherPlayerId) {
                    otherPlayerUsername = this.gameService.getPlayerComponent(otherPlayerId).user.username;
                }
                // END OF: logging data

                if (card.subType === NechtoCardSubType.Defence) { // Playing a defence card
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            otherUsername: otherPlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.DefenceFromHand,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    const requestedCard = this.gameService.getActiveRequestedCard();
                    const activeEventCard = this.gameService.getActiveEventCard();

                    switch (card.action) {
                        case NechtoCardAction.Event_Defence_Fear:
                            if (isNil(requestedCard)) {
                                throw new Error('Missing requested card');
                            }

                            nextStepPhases = [StepPhase.ReturnToPlayer];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                            game.table[activePlayerId] = game.table[activePlayerId].map((item) => {
                                if (item.id === requestedCard.id) {
                                    return { ...item, sharedWithPlayerId: activePlayerId };
                                } else {
                                    return item;
                                }
                            });
                            game.table[activePlayerId].push({ ...card });

                            break;

                        case NechtoCardAction.Event_Defence_Miss:
                            // Put the defence card on the table
                            nextStepPhases = [StepPhase.DropFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                            game.table[activePlayerId].push({ ...card });

                            break;

                        case NechtoCardAction.Event_Defence_NoBarbecue:
                            if (isNil(activeEventCard)) {
                                throw new Error('Missing active event card');
                            }

                            nextStepPhases = [StepPhase.DropFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                            game.table[activePlayerId].push({ ...card });

                            break;

                        case NechtoCardAction.Event_Defence_NoThanks:
                            if (isNil(requestedCard)) {
                                throw new Error('Missing requested card');
                            }

                            nextStepPhases = [StepPhase.ReturnToPlayer];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                            game.table[activePlayerId].push({ ...card });

                            break;

                        case NechtoCardAction.Event_Defence_GoodHere:
                            if (isNil(activeEventCard)) {
                                throw new Error('Missing active event card');
                            }

                            nextStepPhases = [StepPhase.DropFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                            game.table[activePlayerId].push({ ...card });

                            break;

                        default: break;
                    }

                    // Check if defencing is forced by the panic/event card - save the state
                    if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                        nextStepPhases.push(StepPhase.ProcessPanic);
                    } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) {
                        nextStepPhases.push(StepPhase.ProcessEvent);
                    }
                } else { // Playing a regular card
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            otherUsername: otherPlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.PlayFromHand,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);

                    const nextPlayerId = this.gameService.getNextPlayer().playerId;
                    const fulfillmentCheck = this.processHandFulfillment(activePlayerId);

                    card.eventRequester = activePlayerId;

                    switch (card.action) {
                        case NechtoCardAction.Event_Obstacle_LockedDoor:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            game.borders[activePlayerId].push({ ...card, blockFrom: otherPlayerId });

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Obstacle_Quarantine:
                            if (otherPlayerId !== activePlayerId) { // Putting another player into the quarantine
                                game.table[otherPlayerId].push({ ...card, stepsSpent: 0 });
                            } else { // Putting self into the quarantine. As it is current player step - set stepsSpent to 1
                                game.table[otherPlayerId].push({ ...card, stepsSpent: 1 });
                            }

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Action_Whiskey:
                            nextStepPhases = [StepPhase.DropFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.table[activePlayerId].push({ ...card });
                            game.hands[activePlayerId].forEach((item) => item.shared = true);

                            break;

                        case NechtoCardAction.Event_Action_RunAway:
                        case NechtoCardAction.Event_Action_SwapPlaces:
                        case NechtoCardAction.Event_Action_LookAround:
                        case NechtoCardAction.Event_Action_Axe:
                            // Process further by showing everybody a card and playing it from table to somebody in the next phase
                            nextStepPhases = [StepPhase.PlayFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.table[activePlayerId].push({ ...card });

                            break;

                        case NechtoCardAction.Event_Action_Temptation:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            // Process further by showing everybody a card and starting an exchange with the selected player
                            nextStepPhases = [StepPhase.GiveToSpecificPlayer];
                            nextStepPlayerId = activePlayerId;

                            game.table[otherPlayerId].push({ ...card });
                            break;

                        case NechtoCardAction.Event_Action_Flamethrower:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            game.table[otherPlayerId].push({ ...card });

                            // Other player has a defence card - move to his step
                            if (game.hands[otherPlayerId].some((item) => item.action === NechtoCardAction.Event_Defence_NoBarbecue)) {
                                nextStepPhases = [StepPhase.DefenceFromHand];
                                nextStepPlayerId = otherPlayerId;
                            } else { // Other player is being destroyed by the flamethrower
                                // Next line is responsible for sharing hand cards of the destroyed player
                                // game.hands[otherPlayerId].forEach((item) => item.shared = true);

                                res$.push(...this.processRoleChange(otherPlayerId, Role.Inactive));

                                nextStepPhases = [StepPhase.DropFromTable];
                                nextStepPlayerId = activePlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Action_Analysis:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            nextStepPhases = [StepPhase.DropFromTable];
                            nextStepPlayerId = activePlayerId;

                            game.table[otherPlayerId].push({ ...card });
                            game.hands[otherPlayerId].forEach((item) => item.sharedWithPlayerId = activePlayerId);

                            break;

                        case NechtoCardAction.Event_Action_Persistence:
                            // Process further by placing the card on the table
                            nextStepPhases = [StepPhase.TakeFromDeck];
                            nextStepPlayerId = activePlayerId;

                            game.table[activePlayerId].push({ ...card });
                            break;

                        case NechtoCardAction.Event_Action_Suspicion:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            nextStepPhases = [StepPhase.PickFromHand];
                            nextStepPlayerId = activePlayerId;

                            game.table[otherPlayerId].push({ ...card });

                            break;

                        default:
                            nextStepPhases = [];
                            nextStepPlayerId = activePlayerId;

                            game.table[activePlayerId].push(card);

                            break;
                    }

                    // We don't need to add 'ProcessEvent' phase for obstacle cards, as they are passively processed.
                    if (card.subType !== NechtoCardSubType.Obstacle) {
                        nextStepPhases.push(StepPhase.ProcessEvent);
                    }
                }

                res$.push(
                    this.updateGameData(selectedRoomId, {
                        hands: game.hands,
                        borders: game.borders,
                        table: game.table,
                        currentStepPhases: nextStepPhases,
                        previousStepPhases: this.gameService.currentStepPhases,
                        currentStepPlayerId: nextStepPlayerId,
                        previousStepPlayerId: activePlayerId,
                        lastCard: card
                    })
                );

                return forkJoin(res$).pipe(this.processGameStatePipe);
        }
    }

    public playTableCard(cardId: string, otherPlayerId?: number): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.PlayFromTable)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                const card = game.table[activePlayerId].find((item) => item.id === cardId);
                if (isNil(card)) {
                    throw new Error('Missing card');
                }

                let nextPlayerId = this.gameService.getNextPlayer().playerId;
                let nextStepPlayerId: number;
                const res$: Observable<any>[] = [];

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                let otherPlayerUsername: string;
                if (otherPlayerId) {
                    otherPlayerUsername = this.gameService.getPlayerComponent(otherPlayerId).user.username;
                }
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        otherUsername: otherPlayerUsername,
                        cardAction: card.action,
                        stepPhase: StepPhase.PlayFromTable,
                        processedAt: new Date()
                    })
                ).subscribe();

                if (card.type === NechtoCardType.Panic) { // Playing a received panic card
                    switch (card.action) {
                        case NechtoCardAction.Panic_OldRopes:
                            Object.keys(game.table).forEach((playerId) => {
                                const id = parseInt(playerId, null);
                                game.table[id] = game.table[id].filter((item) => {
                                    if (item.id === cardId || item.action === NechtoCardAction.Event_Obstacle_Quarantine) {
                                        game.trash.unshift(item);
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });
                            });

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Panic_BetweenUs:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            nextStepPhases = [StepPhase.DropFromTable, StepPhase.ProcessPanic];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId].forEach((item) => item.sharedWithPlayerId = otherPlayerId);

                            break;

                        case NechtoCardAction.Panic_Oops:
                            nextStepPhases = [StepPhase.DropFromTable, StepPhase.ProcessPanic];
                            nextStepPlayerId = activePlayerId;

                            game.hands[activePlayerId].forEach((item) => item.shared = true);

                            break;

                        case NechtoCardAction.Panic_GoAway:
                        case NechtoCardAction.Panic_OneTwo:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if (item.id === cardId) {
                                    game.trash.unshift({ ...item, hidden: true });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            res$.push(...this.processSwapPlaces(activePlayerId, otherPlayerId));

                            // Check if the player can exchange from the updated position + check for closest available player.
                            nextPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;

                            if (this.gameService.canExchangeBoth(otherPlayerId, nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = otherPlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(otherPlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Panic_IsItParty:
                            // At first, remove all quarantine and locked door cards (+ also remove the panic card)

                            Object.keys(game.table).forEach((playerId) => {
                                const id = parseInt(playerId, null);
                                game.table[id] = game.table[id].filter((item) => {
                                    if (item.id !== cardId && item.action !== NechtoCardAction.Event_Obstacle_Quarantine) {
                                        return true;
                                    } else {
                                        game.trash.unshift(item);
                                        return false;
                                    }
                                });
                            });

                            Object.keys(game.borders).forEach((playerId) => {
                                const id = parseInt(playerId, null);
                                game.borders[id] = game.borders[id].filter((item) => {
                                    if (item.action === NechtoCardAction.Event_Obstacle_LockedDoor) {
                                        game.trash.unshift(item);
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });
                            });

                            // Secondly, swap all player places between each others

                            // Re-order the player IDs array to start from current player ID
                            let activePlayerIds = this.gameService.getActivePlayerComponents().map((item) => item.playerId);

                            activePlayerIds = reorderArray(
                                activePlayerIds,
                                activePlayerIds.findIndex((playerId) => playerId === activePlayerId)
                            );

                            // If we have an odd amount of players - remove last player ID
                            // from the list, as it will still be on the same place
                            if (activePlayerIds.length % 2 !== 0) {
                                activePlayerIds.pop();
                            }

                            // Re-organize the array by swapping elements with odd and even indexes
                            activePlayerIds.forEach((playerId, index) => {
                                // Process swap from each even index (2n) to the neighbor player ID (2n + 1)
                                if (index % 2 === 0) {
                                    res$.push(...this.processSwapPlaces(playerId, activePlayerIds[index + 1]));

                                    // Set respective next player ID, if current swap involved active player ID
                                    if (activePlayerId === playerId) {
                                        nextPlayerId = activePlayerIds[index + 1];
                                    } else if (activePlayerId === activePlayerIds[index + 1]) {
                                        nextPlayerId = playerId;
                                    }
                                }
                            });

                            // We can be sure that the player is able to exchange with neighbor,
                            // because all quarantine and locked door cards were trashed
                            nextStepPhases = [StepPhase.GiveToNextPlayer];
                            nextStepPlayerId = nextPlayerId;

                            break;

                        case NechtoCardAction.Panic_ThreeFour:
                            // Trash a panic card
                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if (item.id === cardId) {
                                    game.trash.unshift({ ...item, hidden: true });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            // Trash all locked doors
                            Object.keys(game.borders).forEach((playerId) => {
                                const id = parseInt(playerId, null);
                                game.borders[id] = game.borders[id].filter((item) => {
                                    if (item.action !== NechtoCardAction.Event_Obstacle_LockedDoor) {
                                        return true;
                                    } else {
                                        game.trash.unshift(item);
                                        return false;
                                    }
                                });
                            });

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        default: break;
                    }
                } else { // Finishing to play an event card
                    switch (card.action) {
                        case NechtoCardAction.Event_Action_RunAway:
                        case NechtoCardAction.Event_Action_SwapPlaces:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            const otherPlayerCanDefence = game.hands[otherPlayerId].some((item) => {
                                return item.subType === NechtoCardSubType.Defence
                                    && item.action === NechtoCardAction.Event_Defence_GoodHere;
                            });

                            // If other player has any defence card - let him decide if there will be a swap
                            if (otherPlayerCanDefence) {
                                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                    if (item.id === cardId) {
                                        game.table[otherPlayerId].push({
                                            ...item,
                                            eventRequester: activePlayerId,
                                            requester: activePlayerId
                                        });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });

                                nextStepPhases = [StepPhase.DefenceFromHand, StepPhase.AcceptRequest, StepPhase.ProcessEvent];
                                nextStepPlayerId = otherPlayerId;
                            } else { // No defence found - process players swapping
                                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                    if (item.id === cardId) {
                                        game.trash.unshift({ ...item, hidden: true });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });

                                res$.push(...this.processSwapPlaces(activePlayerId, otherPlayerId));

                                // Check if the player can exchange from the updated position + check for closest available player.
                                nextPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;

                                if (this.gameService.canExchangeBoth(otherPlayerId, nextPlayerId)) {
                                    nextStepPhases = [StepPhase.GiveToNextPlayer];
                                    nextStepPlayerId = otherPlayerId;
                                } else {
                                    const fulfillmentCheck = this.processHandFulfillment(otherPlayerId);
                                    nextStepPhases = fulfillmentCheck.nextStepPhases;
                                    nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                                }
                            }

                            break;

                        case NechtoCardAction.Event_Action_Axe:
                            if (isNil(otherPlayerId)) {
                                throw new Error('Missing other Player ID');
                            }

                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if (item.id === cardId) {
                                    game.trash.unshift({ ...item, hidden: true });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            if (this.gameService.hasQuarantine(otherPlayerId)) { // Applying axe on quarantine
                                game.table[otherPlayerId] = game.table[otherPlayerId].filter((item) => {
                                    if (item.action === NechtoCardAction.Event_Obstacle_Quarantine) {
                                        game.trash.unshift({ ...item, hidden: true });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });
                            } else if (this.gameService.hasLockedDoor(otherPlayerId, activePlayerId)) {
                                if (otherPlayerId === activePlayerId) { // Applying axe on the first found personal door
                                    const firstFoundDoorIndex = game.borders[activePlayerId].findIndex((item) => {
                                        return item.action === NechtoCardAction.Event_Obstacle_LockedDoor;
                                    });
                                    game.trash.unshift({ ...game.borders[activePlayerId][firstFoundDoorIndex] });
                                    game.borders[activePlayerId].splice(firstFoundDoorIndex, 1);
                                } else { // Applying axe on first other door
                                    game.borders[otherPlayerId] = game.borders[otherPlayerId].filter((item) => {
                                        if (item.blockFrom === activePlayerId) {
                                            game.trash.unshift({ ...item, hidden: true });
                                            return false;
                                        } else {
                                            return true;
                                        }
                                    });
                                }
                            }

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Action_LookAround:
                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if (item.id === cardId) {
                                    game.trash.unshift({ ...item, hidden: true });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            game.direction = (game.direction === Direction.Clockwise) ? Direction.CounterClockwise : Direction.Clockwise;

                            // Refresh next player after the direction change
                            nextPlayerId = this.gameService.getNextPlayer().playerId;

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        default: break;
                    }
                }

                res$.push(
                    this.updateGameData(selectedRoomId, {
                        hands: game.hands,
                        table: game.table,
                        trash: game.trash,
                        borders: game.borders,
                        direction: game.direction,
                        currentStepPhases: nextStepPhases,
                        previousStepPhases: this.gameService.currentStepPhases,
                        currentStepPlayerId: nextStepPlayerId,
                        previousStepPlayerId: activePlayerId,
                        lastCard: card
                    })
                );

                return forkJoin(res$);
        }
    }

    public dropTableCard(cardId: string): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.DropFromTable)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                const tablePartId = this.gameService.getTablePartId(cardId);
                const card = this.gameService.currentGameTable[tablePartId].find((item) => item.id === cardId);
                if (isNil(card)) {
                    throw new Error('Missing card');
                }
                let otherPlayerId = tablePartId;

                let nextPlayerId = this.gameService.getNextPlayer().playerId;
                let nextStepPlayerId: number;
                const activeEventCard = this.gameService.getActiveEventCard();
                let reservedStepPhases = game.reservedStepPhases;
                let reservedStepPlayerId = game.reservedStepPlayerId;

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        cardAction: card.action,
                        stepPhase: StepPhase.DropFromTable,
                        processedAt: new Date()
                    })
                ).subscribe();

                if (card.type === NechtoCardType.Panic) { // Dropping a received panic card
                    switch (card.action) {
                        case NechtoCardAction.Panic_BetweenUs:
                            game.hands[activePlayerId].forEach((item) => item.sharedWithPlayerId = null);
                            break;

                        case NechtoCardAction.Panic_ConfessionTime:
                        case NechtoCardAction.Panic_Oops:
                            Object.keys(game.hands).forEach((playerId) => {
                                const id = parseInt(playerId, null);
                                game.hands[id].forEach((item) => item.shared = false);
                            });

                            break;

                        case NechtoCardAction.Panic_OneTwo:
                        case NechtoCardAction.Panic_GoAway:
                        default:
                            break;
                    }

                    game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                        if (item.id === cardId) {
                            game.trash.unshift({ ...item, hidden: true });
                            return false;
                        } else {
                            return true;
                        }
                    });

                    if (this.gameService.canExchange(nextPlayerId)) {
                        nextStepPhases = [StepPhase.GiveToNextPlayer];
                        nextStepPlayerId = activePlayerId;
                    } else {
                        const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                        nextStepPhases = fulfillmentCheck.nextStepPhases;
                        nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                    }
                } else { // Dropping (or finishing to play) an event card
                    switch (card.action) {
                        case NechtoCardAction.Event_Action_Whiskey:
                            game.hands[activePlayerId].forEach((item) => item.shared = null);

                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if (item.id === cardId) {
                                    game.trash.unshift({ ...item, hidden: true });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Action_Flamethrower:
                            game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            });
                            game.borders[tablePartId] = game.borders[tablePartId].filter((item) => {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            });
                            game.hands[tablePartId] = game.hands[tablePartId].filter((item) => {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            });

                            if (this.gameService.canExchange(nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Defence_NoBarbecue:
                            if (!activeEventCard) {
                                throw new Error('Missing active event card');
                            }

                            const nextAfterRequesterPlayerId = this.gameService.getNextPlayer(activeEventCard.eventRequester).playerId;

                            nextStepPhases = [StepPhase.FulfillHandFromDeck];
                            nextStepPlayerId = activePlayerId;
                            if (this.gameService.canExchangeBoth(activeEventCard.eventRequester, nextAfterRequesterPlayerId)) {
                                reservedStepPhases = [StepPhase.GiveToNextPlayer];
                                reservedStepPlayerId = activeEventCard.eventRequester;
                            } else {
                                reservedStepPhases = [StepPhase.TakeFromDeck];
                                reservedStepPlayerId = nextAfterRequesterPlayerId;
                            }

                            game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                if ([cardId, activeEventCard.id].includes(item.id)) {
                                    game.trash.unshift({ ...item, hidden: true, eventRequester: null });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            break;

                        case NechtoCardAction.Event_Action_Suspicion:
                            // Hide back the previously selected card of another player
                            game.hands[otherPlayerId].find((item) => item.sharedWithPlayerId === activePlayerId).sharedWithPlayerId = null;

                            // Trash the event card
                            game.table[otherPlayerId] = game.table[otherPlayerId].filter((item) => {
                                if (item.id === card.id) {
                                    game.trash.unshift({ ...item, hidden: true, eventRequester: null });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            if (this.gameService.canExchangeBoth(activePlayerId, nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Action_Analysis:
                            // Hide back previously shared cards of another player
                            game.hands[tablePartId].forEach((item) => item.sharedWithPlayerId = null);

                            // Trash the event card
                            game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                                if (item.id === card.id) {
                                    game.trash.unshift({ ...item, hidden: true, eventRequester: null });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            if (this.gameService.canExchangeBoth(activePlayerId, nextPlayerId)) {
                                nextStepPhases = [StepPhase.GiveToNextPlayer];
                                nextStepPlayerId = activePlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                nextStepPhases = fulfillmentCheck.nextStepPhases;
                                nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        case NechtoCardAction.Event_Defence_Miss:
                            const requestedCard = this.gameService.getActiveRequestedCard();
                            if (isNil(requestedCard)) {
                                throw new Error('Missing requested card');
                            }

                            // Make your next neighbor a swap receiver instead of you.
                            // Next neighbor can be an event requester (circle loop) - try to get +1 next neighbor.
                            if (activeEventCard && nextPlayerId === activeEventCard.eventRequester) {
                                nextPlayerId = this.gameService.getNextPlayer(nextPlayerId).playerId;
                            }

                            // Move requested card to the next receiver.
                            // If active event card also exists - move it as well.
                            game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                                if (item.id === requestedCard.id || (activeEventCard && item.id === activeEventCard.id)) {
                                    game.table[nextPlayerId].push({ ...item });
                                    return false;
                                } else if (item.id === card.id) { // Trash the defence card
                                    game.trash.unshift({ ...item, hidden: true, eventRequester: null });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            nextStepPhases = [StepPhase.FulfillHandFromDeck];
                            nextStepPlayerId = activePlayerId;
                            reservedStepPhases = [StepPhase.GiveToPreviousPlayer, StepPhase.DefenceFromHand];
                            reservedStepPlayerId = nextPlayerId;

                            if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                                reservedStepPhases.push(StepPhase.ProcessPanic);
                            } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) {
                                reservedStepPhases.push(StepPhase.ProcessEvent);
                            }

                            break;

                        case NechtoCardAction.Event_Defence_GoodHere:
                            if (isNil(activeEventCard)) {
                                throw new Error('Missing active event card');
                            }

                            // Trash both defence and event cards from the table part
                            game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                                if (item.id === card.id || (activeEventCard && item.id === activeEventCard.id)) {
                                    game.trash.unshift({ ...item, hidden: true, eventRequester: null });
                                    return false;
                                } else {
                                    return true;
                                }
                            });

                            otherPlayerId = activeEventCard.eventRequester;
                            nextStepPhases = [StepPhase.FulfillHandFromDeck];
                            nextStepPlayerId = activePlayerId;
                            if (this.gameService.canExchangeBoth(otherPlayerId, activePlayerId)) {
                                reservedStepPhases = [StepPhase.GiveToNextPlayer];
                                reservedStepPlayerId = otherPlayerId;
                            } else {
                                const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                                reservedStepPhases = fulfillmentCheck.nextStepPhases;
                                reservedStepPlayerId = fulfillmentCheck.nextPlayerId;
                            }

                            break;

                        default: break;
                    }
                }

                return this.updateGameData(selectedRoomId, {
                    hands: game.hands,
                    table: game.table,
                    trash: game.trash,
                    borders: game.borders,
                    currentStepPhases: nextStepPhases,
                    previousStepPhases: this.gameService.currentStepPhases,
                    currentStepPlayerId: nextStepPlayerId,
                    previousStepPlayerId: activePlayerId,
                    lastCard: card,
                    reservedStepPhases,
                    reservedStepPlayerId
                });
        }
    }

    public dropHandCard(cardId: string) {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.DropFromHand)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                const card = game.hands[activePlayerId].find((item) => item.id === cardId);
                if (isNil(card)) {
                    throw new Error('Missing card');
                }

                game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);

                game.trash.unshift({ ...card, hidden: true });

                const nextPlayerId = this.gameService.getNextPlayer().playerId;
                let nextStepPlayerId: number;
                let maxHandCards = this.MAX_HAND_CARDS;

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        cardAction: card.action,
                        stepPhase: StepPhase.DropFromHand,
                        processedAt: new Date()
                    })
                ).subscribe();

                // Check if card dropping is forced by the panic card. If yes - then also process the panic card
                if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                    const activePanicCard = this.gameService.getActivePanicCard();
                    if (isNil(activePanicCard)) {
                        throw new Error('Missing active panic card');
                    }

                    switch (activePanicCard.action) {
                        case NechtoCardAction.Panic_BlindDate:
                            nextStepPhases = [StepPhase.TakeFromDeck];
                            nextStepPlayerId = activePlayerId;

                            break;

                        case NechtoCardAction.Panic_Forgetfulness:
                            // The panic card stops after dropping 3 hand cards
                            if (game.hands[activePlayerId].length === maxHandCards - 3) {
                                nextStepPhases = [StepPhase.FulfillHandFromDeck];
                                nextStepPlayerId = activePlayerId;
                            } else { // Proceed to drop hand cards
                                nextStepPhases = [StepPhase.DropFromHand];
                                nextStepPlayerId = activePlayerId;
                            }

                            break;

                        default:
                            break;
                    }

                    nextStepPhases.push(StepPhase.ProcessPanic);
                } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) { // Check if card dropping is forced by the event card
                    const activeEventCard = this.gameService.getActiveEventCard();
                    if (isNil(activeEventCard)) {
                        throw new Error('Missing active event card');
                    }

                    switch (activeEventCard.action) {
                        case NechtoCardAction.Event_Action_Persistence:
                            maxHandCards += 1;
                            nextStepPlayerId = activePlayerId;

                            if (game.hands[activePlayerId].length > maxHandCards) { // Too many hand cards - continue to drop more
                                nextStepPhases = [StepPhase.DropFromHand, StepPhase.ProcessEvent];
                            } else { // Proceed to next phases
                                nextStepPhases = [StepPhase.DropFromHand, StepPhase.PlayFromHand];

                                // Trash the event card, as it has been processed
                                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                                    if (item.id === activeEventCard.id) {
                                        game.trash.unshift({ ...item, hidden: true });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });
                            }

                            break;

                        case NechtoCardAction.Panic_Forgetfulness:
                            // The panic card stops after dropping 3 hand cards
                            if (game.hands[activePlayerId].length === maxHandCards - 3) {
                                nextStepPhases = [StepPhase.FulfillHandFromDeck, StepPhase.ProcessPanic];
                                nextStepPlayerId = activePlayerId;
                            } else { // Proceed to drop hand cards
                                nextStepPhases = [StepPhase.DropFromHand, StepPhase.ProcessPanic];
                                nextStepPlayerId = activePlayerId;
                            }

                            break;

                        default:
                            break;
                    }
                } else { // Regular dropping
                    if (this.gameService.canExchange(nextPlayerId)) {
                        nextStepPhases = [StepPhase.GiveToNextPlayer];
                        nextStepPlayerId = activePlayerId;
                    } else {


                        const fulfillmentCheck = this.processHandFulfillment(activePlayerId);
                        nextStepPhases = fulfillmentCheck.nextStepPhases;
                        nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                    }
                }

                return this.updateGameData(selectedRoomId, {
                    hands: game.hands,
                    table: game.table,
                    trash: game.trash,
                    currentStepPhases: nextStepPhases,
                    previousStepPhases: this.gameService.currentStepPhases,
                    currentStepPlayerId: nextStepPlayerId,
                    previousStepPlayerId: activePlayerId,
                    lastCard: card
                });
        }
    }

    public giveHandCard(cardId: string, otherPlayerId: number): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        const activePlayerId = this.gameService.getCurrentStepPlayerId();
        const selectedRoomId = this.roomService.getSelectedRoomId();

        const card = game.hands[activePlayerId].find((item) => item.id === cardId);
        if (isNil(card)) {
            throw new Error('Missing card');
        }

        let nextStepPhases: StepPhase[] = [];
        let nextStepPlayerId: number;
        const res$: Observable<any>[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasAnyOfStepPhases(
                    StepPhase.GiveToPlayer,
                    StepPhase.GiveToNextPlayer,
                    StepPhase.GiveToPreviousPlayer,
                    StepPhase.GiveToSpecificPlayer
                )) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const reservedStepPhases = game.reservedStepPhases;
                const reservedStepPlayerId = game.reservedStepPlayerId;

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                let otherPlayerUsername: string;
                if (otherPlayerId) {
                    otherPlayerUsername = this.gameService.getPlayerComponent(otherPlayerId).user.username;
                }
                // END OF: logging data

                // Giving a card to player
                if (this.gameService.hasAnyOfStepPhases(
                    StepPhase.GiveToPlayer,
                    StepPhase.GiveToNextPlayer,
                    StepPhase.GiveToSpecificPlayer
                )) {
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            otherUsername: otherPlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.GiveToPlayer,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    // This might be a card giving forced by the panic card
                    if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                        const activePanicCard = this.gameService.getActivePanicCard();
                        if (isNil(activePanicCard)) {
                            throw new Error('Missing active panic card');
                        }

                        switch (activePanicCard.action) {
                            case NechtoCardAction.Panic_ChainReaction:
                                game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => {
                                    if (item.id === cardId) {
                                        game.hands[otherPlayerId].push({ ...item });
                                        return false;
                                    } else {
                                        return true;
                                    }
                                });

                                const panicRequester = this.gameService.getActivePanicRequester();

                                // Last card giving before the active panic dropping
                                if (panicRequester.playerId === otherPlayerId) {
                                    game.table[otherPlayerId] = game.table[otherPlayerId].filter((item) => {
                                        if (item.type === NechtoCardType.Panic) {
                                            game.trash.unshift({ ...item, hidden: true });
                                            return false;
                                        } else {
                                            return true;
                                        }
                                    });

                                    // Proceed to next player
                                    const nextAfterRequesterPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;
                                    nextStepPhases = [StepPhase.TakeFromDeck];
                                    nextStepPlayerId = nextAfterRequesterPlayerId;
                                } else { // Keep processing the active panic card
                                    nextStepPhases = [StepPhase.GiveToNextPlayer, StepPhase.ProcessPanic];
                                    nextStepPlayerId = otherPlayerId;
                                }

                                res$.push(this.processInfection(otherPlayerId, card));

                                break;

                            case NechtoCardAction.Panic_Friends:
                            default:
                                nextStepPhases = [StepPhase.GiveToPreviousPlayer, StepPhase.DefenceFromHand, StepPhase.ProcessPanic];
                                nextStepPlayerId = otherPlayerId;

                                game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                                game.table[otherPlayerId].push({ ...card, hidden: true, requester: activePlayerId });
                                break;
                        }
                    } else { // Regular hand card giving
                        nextStepPhases = [StepPhase.GiveToPreviousPlayer, StepPhase.DefenceFromHand];
                        nextStepPlayerId = otherPlayerId;

                        if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) { // Giving might be forced by the event card
                            nextStepPhases.push(StepPhase.ProcessEvent);
                        }

                        game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                        game.table[otherPlayerId].push({ ...card, hidden: true, requester: activePlayerId });
                    }
                } else if (this.gameService.hasStepPhase(StepPhase.GiveToPreviousPlayer)) { // Giving back another card
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            otherUsername: otherPlayerUsername,
                            cardAction: card.action,
                            stepPhase: StepPhase.GiveToPreviousPlayer,
                            processedAt: new Date()
                        })
                    ).subscribe();

                    const requestedCard = this.gameService.getActiveRequestedCard();
                    if (isNil(requestedCard)) {
                        throw new Error('Missing requested card');
                    }
                    const nextAfterRequesterPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;

                    game.hands[activePlayerId] = game.hands[activePlayerId].filter((item) => item.id !== cardId);
                    game.hands[otherPlayerId].push({ ...card, hidden: false });
                    game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                        if (item.id === requestedCard.id) {
                            game.hands[activePlayerId].push({ ...item, hidden: false });
                            return false;
                        } else {
                            return true;
                        }
                    });

                    // Card returning is forced by the panic card - put panic card to trash
                    if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                        // If card accepts regular workflow - back to the requester with regular swap
                        const activePanicCard = this.gameService.getActivePanicCard();
                        if (isNil(activePanicCard)) {
                            throw new Error('Missing active panic card');
                        }

                        if ([NechtoCardAction.Panic_Friends].includes(activePanicCard.action)
                            && this.gameService.canExchangeBoth(otherPlayerId, nextAfterRequesterPlayerId)) {
                            nextStepPhases = [StepPhase.GiveToNextPlayer];
                            nextStepPlayerId = otherPlayerId;
                        } else { // Requesters' next player starts
                            nextStepPhases = [StepPhase.TakeFromDeck];
                            nextStepPlayerId = nextAfterRequesterPlayerId;
                        }

                        game.table[otherPlayerId] = game.table[otherPlayerId].filter((item) => {
                            if (item.id === activePanicCard.id) {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            } else {
                                return true;
                            }
                        });
                    } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) { // Returning is forced by the event card - trash it
                        // If card accepts regular workflow - back to the requester with regular swap
                        const activeEventCard = this.gameService.getActiveEventCard();
                        if (isNil(activeEventCard)) {
                            throw new Error('Missing active event card');
                        }

                        if ([].includes(activeEventCard.action)
                            && this.gameService.canExchangeBoth(otherPlayerId, nextAfterRequesterPlayerId)) {
                            nextStepPhases = [StepPhase.GiveToNextPlayer];
                            nextStepPlayerId = otherPlayerId;
                        } else { // Requesters' next player starts
                            nextStepPhases = [StepPhase.TakeFromDeck];
                            nextStepPlayerId = nextAfterRequesterPlayerId;
                        }

                        // Trash the active event card
                        const tablePartId = this.gameService.getTablePartId(activeEventCard.id);
                        game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                            if (item.id === activeEventCard.id) {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            } else {
                                return true;
                            }
                        });
                    } else { // Proceed to next player after the requester
                        nextStepPhases = [StepPhase.TakeFromDeck];
                        nextStepPlayerId = nextAfterRequesterPlayerId;
                    }

                    res$.push(this.processInfection(activePlayerId, requestedCard));
                    res$.push(this.processInfection(otherPlayerId, card));
                }

                res$.push(
                    this.updateGameData(selectedRoomId, {
                        hands: game.hands,
                        table: game.table,
                        trash: game.trash,
                        currentStepPhases: nextStepPhases,
                        previousStepPhases: this.gameService.currentStepPhases,
                        currentStepPlayerId: nextStepPlayerId,
                        previousStepPlayerId: activePlayerId,
                        lastCard: card,
                        reservedStepPhases,
                        reservedStepPlayerId
                    })
                );

                return forkJoin(res$).pipe(this.processGameStatePipe);
        }
    }

    public giveTableCard(cardId: string, otherPlayerId: number) {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        const activePlayerId = this.gameService.getCurrentStepPlayerId();
        const selectedRoomId = this.roomService.getSelectedRoomId();

        const card = game.table[activePlayerId].find((item) => item.id === cardId);
        if (isNil(card)) {
            throw new Error('Missing card');
        }

        let nextStepPhases: StepPhase[] = [];
        let nextStepPlayerId: number;
        const res$: Observable<any>[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.ReturnToPlayer)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                let otherPlayerUsername: string;
                if (otherPlayerId) {
                    otherPlayerUsername = this.gameService.getPlayerComponent(otherPlayerId).user.username;
                }
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        otherUsername: otherPlayerUsername,
                        cardAction: card.action,
                        stepPhase: StepPhase.ReturnToPlayer,
                        processedAt: new Date()
                    })
                ).subscribe();

                const nextAfterRequesterPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;
                const requestedCard = this.gameService.getActiveRequestedCard();
                const activeEventCard = this.gameService.getActiveEventCard();
                const activePanicCard = this.gameService.getActivePanicCard();
                let reservedStepPhases = game.reservedStepPhases;
                let reservedStepPlayerId = game.reservedStepPlayerId;

                if (!requestedCard) {
                    throw new Error('Missing requested card');
                }

                // Returning back a card due to previous defence
                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                    if (item.id === requestedCard.id) {
                        game.hands[otherPlayerId].push({ ...item, hidden: false, requester: null, sharedWithPlayerId: null });
                        return false;
                    } else {
                        return true;
                    }
                });

                // Check if card returning is forced by the panic card
                if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                    // If card accepts regular workflow - back to the requester with regular swap
                    const tablePartId = this.gameService.getTablePartId(activePanicCard.id);

                    nextStepPhases = [StepPhase.FulfillHandFromDeck];
                    nextStepPlayerId = activePlayerId;
                    if ([NechtoCardAction.Panic_Friends].includes(activePanicCard.action)
                        && this.gameService.canExchangeBoth(otherPlayerId, nextAfterRequesterPlayerId)) {
                        reservedStepPhases = [StepPhase.GiveToNextPlayer];
                        reservedStepPlayerId = otherPlayerId;
                    } else { // Requesters' next player starts
                        reservedStepPhases = [StepPhase.TakeFromDeck];
                        reservedStepPlayerId = nextAfterRequesterPlayerId;
                    }

                    // Trash the active panic card, if needed
                    if ([NechtoCardAction.Panic_Friends].includes(activePanicCard.action)) {
                        game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                            if (item.id === activePanicCard.id) {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            } else {
                                return true;
                            }
                        });
                    }
                } else if (this.gameService.hasStepPhase(StepPhase.ProcessEvent)) { // Check if card returning is forced by the event card
                    // If card accepts regular workflow - back to the requester with regular swap
                    nextStepPhases = [StepPhase.FulfillHandFromDeck];
                    nextStepPlayerId = activePlayerId;
                    if ([NechtoCardAction.Event_Action_SwapPlaces].includes(activeEventCard.action)
                        && this.gameService.canExchangeBoth(otherPlayerId, nextAfterRequesterPlayerId)) {
                        reservedStepPhases = [StepPhase.GiveToNextPlayer];
                        reservedStepPlayerId = otherPlayerId;
                    } else { // Requesters' next player starts
                        reservedStepPhases = [StepPhase.TakeFromDeck];
                        reservedStepPlayerId = nextAfterRequesterPlayerId;
                    }

                    // Trash the active event card
                    if (activeEventCard !== requestedCard) {
                        const tablePartId = this.gameService.getTablePartId(activeEventCard.id);
                        game.table[tablePartId] = game.table[tablePartId].filter((item) => {
                            if (item.id === activeEventCard.id) {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            } else {
                                return true;
                            }
                        });
                    }
                } else {
                    // Proceed to next player after the requester
                    nextStepPhases = [StepPhase.FulfillHandFromDeck];
                    nextStepPlayerId = activePlayerId;
                    reservedStepPhases = [StepPhase.TakeFromDeck];
                    reservedStepPlayerId = nextAfterRequesterPlayerId;
                }

                // Put the defence card to trash
                game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                    if (item.subType === NechtoCardSubType.Defence) {
                        game.trash.unshift({ ...item, hidden: true });
                        return false;
                    } else {
                        return true;
                    }
                });

                res$.push(
                    this.updateGameData(selectedRoomId, {
                        hands: game.hands,
                        table: game.table,
                        trash: game.trash,
                        currentStepPhases: nextStepPhases,
                        previousStepPhases: this.gameService.currentStepPhases,
                        currentStepPlayerId: nextStepPlayerId,
                        previousStepPlayerId: activePlayerId,
                        lastCard: card,
                        reservedStepPhases,
                        reservedStepPlayerId
                    })
                );

                return forkJoin(res$);
        }
    }

    public showCards(showAll = true, skipShowing = false): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.ShowFromHand)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                let nextStepPlayerId: number;
                const nextPlayerId = this.gameService.getNextPlayer().playerId;

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        skipShowing,
                        showAll,
                        stepPhase: StepPhase.ShowFromHand,
                        processedAt: new Date()
                    })
                ).subscribe();

                if (this.gameService.hasStepPhase(StepPhase.ProcessPanic)) {
                    const activePanicCard = this.gameService.getActivePanicCard();
                    if (isNil(activePanicCard)) {
                        throw new Error('Missing active panic card');
                    }

                    switch (activePanicCard.action) {
                        case NechtoCardAction.Panic_ConfessionTime:
                        default:
                            const infectionCard = game.hands[activePlayerId].find((item) => {
                                return item.subType === NechtoCardSubType.Infection && item.action !== NechtoCardAction.Event_Infection_It;
                            });

                            if (!skipShowing) {
                                if (showAll) { // Show all cards to players
                                    game.hands[activePlayerId].forEach((item) => item.shared = true);
                                } else { // Show only first found infection card
                                    infectionCard.shared = true;
                                }
                            }

                            const panicRequester = this.gameService.getActivePanicRequester();
                            const isNextPlayerRequester = nextPlayerId === panicRequester.playerId;

                            // Proceed to next player for further cards opening
                            if (!isNextPlayerRequester && (skipShowing || !infectionCard)) {
                                nextStepPhases = [StepPhase.ShowFromHand, StepPhase.ProcessPanic];
                                nextStepPlayerId = nextPlayerId;
                            } else { // Stop the opening process
                                nextStepPhases = [StepPhase.DropFromTable, StepPhase.ProcessPanic];
                                nextStepPlayerId = panicRequester.playerId;
                            }

                            break;
                    }
                }

                return this.updateGameData(selectedRoomId, {
                    hands: game.hands,
                    currentStepPhases: nextStepPhases,
                    previousStepPhases: this.gameService.currentStepPhases,
                    currentStepPlayerId: nextStepPlayerId,
                    previousStepPlayerId: activePlayerId,
                    lastCard: this.gameService.lastCard
                });
        }
    }

    public skipShowingCards() {
        return this.showCards(false, true);
    }

    public acceptRequest(): Observable<any> {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;
        let nextStepPhases: StepPhase[] = [];

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                if (!this.gameService.hasStepPhase(StepPhase.AcceptRequest)) {
                    console.warn('Incorrect step phase');
                    return EMPTY;
                }

                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                let nextStepPlayerId: number;
                let nextPlayerId = this.gameService.getNextPlayer().playerId;
                const activeEventCard = this.gameService.getActiveEventCard();
                if (isNil(activeEventCard)) {
                    throw new Error('Missing active event card');
                }

                let otherPlayerId = activeEventCard.eventRequester;
                const res$: Observable<any>[] = [];

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                let otherPlayerUsername: string;
                if (otherPlayerId) {
                    otherPlayerUsername = this.gameService.getPlayerComponent(otherPlayerId).user.username;
                }
                // END OF: logging data

                this.gameInfoService.saveStepInfo(
                    selectedRoomId,
                    new StepInfoDto({
                        roomId: selectedRoomId,
                        activeUsername: activePlayerUsername,
                        otherUsername: otherPlayerUsername,
                        stepPhase: StepPhase.AcceptRequest,
                        processedAt: new Date()
                    })
                ).subscribe();

                switch (activeEventCard.action) {
                    case NechtoCardAction.Event_Action_RunAway:
                    case NechtoCardAction.Event_Action_SwapPlaces:
                        if (isNil(otherPlayerId)) {
                            throw new Error('Missing other Player ID');
                        }

                        game.table[activePlayerId] = game.table[activePlayerId].filter((item) => {
                            if (item.id === activeEventCard.id) {
                                game.trash.unshift({ ...item, hidden: true });
                                return false;
                            } else {
                                return true;
                            }
                        });

                        res$.push(...this.processSwapPlaces(activePlayerId, otherPlayerId));

                        // Check if other player can exchange from the updated position
                        otherPlayerId = activePlayerId;
                        nextPlayerId = this.gameService.getNextPlayer(otherPlayerId).playerId;

                        if (this.gameService.canExchangeBoth(otherPlayerId, nextPlayerId)) {
                            nextStepPhases = [StepPhase.GiveToNextPlayer];
                            nextStepPlayerId = otherPlayerId;
                        } else {
                            const fulfillmentCheck = this.processHandFulfillment(otherPlayerId);
                            nextStepPhases = fulfillmentCheck.nextStepPhases;
                            nextStepPlayerId = fulfillmentCheck.nextPlayerId;
                        }

                        break;

                    default:
                        break;
                }

                res$.push(
                    this.updateGameData(selectedRoomId, {
                        hands: game.hands,
                        table: game.table,
                        trash: game.trash,
                        currentStepPhases: nextStepPhases,
                        previousStepPhases: this.gameService.currentStepPhases,
                        currentStepPlayerId: nextStepPlayerId,
                        previousStepPlayerId: activePlayerId,
                        lastCard: this.gameService.lastCard
                    })
                );

                return forkJoin(res$);
        }
    }

    public refillDeck() {
        if (!this.isTakingStep || !this.gameService.hasCurrentGame) {
            console.warn('Not taking step or not in the game');
            return;
        }

        const game = this.gameService.currentGame;

        switch (this.gameService.getSelectedGame()) {
            case Game.Nechto:
            default:
                const activePlayerId = this.gameService.getCurrentStepPlayerId();
                const selectedRoomId = this.roomService.getSelectedRoomId();

                // START OF: logging data
                const activePlayerUsername = this.gameService.getPlayerComponent(activePlayerId).user.username;
                // END OF: logging data

                game.deck.push(...shuffleArray(game.trash));
                game.trash = [];

                return forkJoin([
                    this.updateGameData(selectedRoomId, { ...game }),
                    this.gameInfoService.saveStepInfo(
                        selectedRoomId,
                        new StepInfoDto({
                            roomId: selectedRoomId,
                            activeUsername: activePlayerUsername,
                            stepPhase: StepPhase.RefillDeck,
                            processedAt: new Date()
                        })
                    )
                ]);
        }
    }

    public putOnQuarantine(playerId: number) {
        if (!playerId) {
            console.warn('Missing Player ID');
            return EMPTY;
        }

        if (!this.gameService.hasCurrentGame) {
            console.warn('Not in the game');
            return EMPTY;
        }

        const game = this.gameService.currentGame;
        const selectedRoomId = this.roomService.getSelectedRoomId();

        game.table[playerId].push(
            new NechtoCard({
                id: this.firebaseService.generateId(),
                type: NechtoCardType.Event,
                subType: NechtoCardSubType.Obstacle,
                action: NechtoCardAction.Event_Obstacle_Quarantine,
                eventRequester: playerId,
                stepsSpent: 0,
                hidden: false
            })
        );

        return this.updateGameData(selectedRoomId, {
            table: game.table,
            currentStepPhases: game.currentStepPhases,
            previousStepPhases: this.gameService.currentStepPhases,
            currentStepPlayerId: game.currentStepPlayerId,
            previousStepPlayerId: game.previousStepPlayerId,
            lastCard: game.lastCard
        });
    }

    public setLockedDoor(option: LockedDoorOption) {
        if (!option || !option.fromId || !option.toId) {
            throw new Error('Missing Locked Door option data');
        }

        if (!this.gameService.hasCurrentGame) {
            console.warn('Not in the game');
            return EMPTY;
        }

        const game = this.gameService.currentGame;
        const selectedRoomId = this.roomService.getSelectedRoomId();

        game.borders[option.fromId].push(
            new NechtoCard({
                id: this.firebaseService.generateId(),
                type: NechtoCardType.Event,
                subType: NechtoCardSubType.Obstacle,
                action: NechtoCardAction.Event_Obstacle_LockedDoor,
                eventRequester: option.fromId,
                blockFrom: option.toId,
                hidden: false
            })
        );

        return this.updateGameData(selectedRoomId, {
            borders: game.borders,
            currentStepPhases: game.currentStepPhases,
            previousStepPhases: this.gameService.currentStepPhases,
            currentStepPlayerId: game.currentStepPlayerId,
            previousStepPlayerId: game.previousStepPlayerId,
            lastCard: game.lastCard
        });
    }

    private processQuarantine(playerId: number, nextStepPhases: StepPhase[] = []): QuarantineCheck {
        if (!playerId) {
            console.warn('Player ID not specified');
            return null;
        }

        const table = { ...this.gameService.currentGameTable };
        const trash = [...this.gameService.currentGameTrash];

        // If player does not have any of required conditions - do not change anything
        if (!this.gameService.hasQuarantine(playerId)
            || nextStepPhases.includes(StepPhase.ProcessPanic)
            || nextStepPhases.includes(StepPhase.ProcessEvent)
            || !nextStepPhases.includes(StepPhase.TakeFromDeck)) {

            return { table, trash };
        }

        const quarantineTableCard = table[playerId].find((item) => {
            return item.action === NechtoCardAction.Event_Obstacle_Quarantine;
        });

        if (quarantineTableCard.stepsSpent < 3) { // increment steps counter on the quarantine card
            quarantineTableCard.stepsSpent += 1;
        } else { // quarantine card has expired and should be dropped
            table[playerId] = table[playerId].filter((item) => {
                if (item.id === quarantineTableCard.id) {
                    trash.unshift(item);
                    return false;
                } else {
                    return true;
                }
            });
        }

        return { table, trash };
    }

    private processHandFulfillment(playerId: number): FulfillmentCheck {
        if (this.gameService.currentGameHands[playerId].length < this.MAX_HAND_CARDS) { // Not enough hand cards
            return {
                nextStepPhases: [StepPhase.FulfillHandFromDeck],
                nextPlayerId: playerId
            };
        } else { // Proceed to next player
            return {
                nextStepPhases: [StepPhase.TakeFromDeck],
                nextPlayerId: this.gameService.getNextPlayer(playerId).playerId
            };
        }
    }

    private processReservedData(nextStepPhases: StepPhase[], nextStepPlayerId: number)
        : Pick<GameDto, 'currentStepPhases' | 'currentStepPlayerId' | 'reservedStepPhases' | 'reservedStepPlayerId'> {
        if (this.gameService.hasReservedData) { // Check for reserved step data (can be saved after mid-step fulfillment)
            return {
                currentStepPhases: this.gameService.currentGame.reservedStepPhases,
                currentStepPlayerId: this.gameService.currentGame.reservedStepPlayerId,
                reservedStepPhases: [],
                reservedStepPlayerId: null
            };
        } else {
            return {
                currentStepPhases: nextStepPhases,
                currentStepPlayerId: nextStepPlayerId,
                reservedStepPhases: [],
                reservedStepPlayerId: null
            };
        }
    }

    private processRoleChange(playerId: number, role: Role): Observable<any>[] {
        const selectedRoomId = this.roomService.getSelectedRoomId();
        const otherUser = this.roomService.getRoomMemberByPlayerId(playerId, selectedRoomId);
        const obs$: Observable<any>[] = [of(true)];

        if (otherUser.role !== role) {
            obs$.push(
                this.firebaseService.update(
                    PlayerDto,
                    'players',
                    `${selectedRoomId}_${otherUser.userId}`,
                    { role, previousRole: otherUser.role }
                )
            );
        }

        return obs$;
    }

    /**
     * Processing infection part
     */
    private processInfection(playerId: number, card: NechtoCard): Observable<any> {
        const selectedRoomId = this.roomService.getSelectedRoomId();

        const gotInfected = this.gameService.isHuman(playerId) && card.subType === NechtoCardSubType.Infection;
        let obs$: Observable<any> = of(true);

        if (gotInfected) {
            const userId = this.roomService.getRoomMemberByPlayerId(playerId, selectedRoomId).userId;

            obs$ = this.firebaseService.update(
                PlayerDto,
                'players',
                `${selectedRoomId}_${userId}`,
                { role: Role.Infected }
            );
        }

        return obs$;
    }

    private processSwapPlaces(firstPlayerId: number, secondPlayerId: number) {
        if (!firstPlayerId || !secondPlayerId) {
            throw new Error('Missing first or second Player ID');
        }

        const game = this.gameService.currentGame;

        // Swap player hands
        const currentFirstPlayerHand = [...game.hands[firstPlayerId]];
        game.hands[firstPlayerId] = [...game.hands[secondPlayerId]];
        game.hands[secondPlayerId] = currentFirstPlayerHand;

        // TODO: investigate if swapping player streams is working correctly
        return this.gameService.swapPlayers(firstPlayerId, secondPlayerId);
    }

    private updateGameData(
        roomId: string,
        data: Partial<GameDto>
            & Pick<
                GameDto,
                'currentStepPhases' | 'previousStepPhases' | 'currentStepPlayerId' | 'previousStepPlayerId' | 'lastCard'
            >
    ) {
        return this.firebaseService.update(GameDto, 'games', roomId, data);
    }

    private processGameStatePipe: (source: Observable<any>) => Observable<any> = (source) => source.pipe(
        tap(() => {
            // Finish the game, if anybody has won
            if (this.roomService.anybodyWon() && !this.roomService.isGameFinished()) {
                this.roomService.setGameFinished(this.roomService.getSelectedRoomId(), true).subscribe();
            }
        })
    )
}
