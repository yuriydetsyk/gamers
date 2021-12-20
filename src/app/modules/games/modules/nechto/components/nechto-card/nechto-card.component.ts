import { Component, Input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { CardService } from '../../../../../../core/services/card.service';
import { GameService } from '../../../../../../core/services/game.service';
import { CardLocation } from '../../../../../../models/enums/card-location.enum';
import { NechtoCardAction } from '../../../../../../models/enums/nechto-card-action.enum';
import { NechtoCardSubType } from '../../../../../../models/enums/nechto-card-sub-type.enum';
import { NechtoCardType } from '../../../../../../models/enums/nechto-card-type.enum';
import { StepPhase, TakeStepPhase } from '../../../../../../models/enums/step-phase.enum';
import { NechtoCard } from '../../../../../../models/nechto-card.model';
import { isNil } from '../../../../../../core/helpers/type.helpers';
import { NechtoPlayerComponent } from '../nechto-player/nechto-player.component';
import { GameActionGroup } from '../../../../../../models/enums/game-action-group.enum';
import { RoomService } from '../../../../../../core/services/room.service';
import { UserService } from '../../../../../../core/services/user.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'gw-nechto-card',
    templateUrl: './nechto-card.component.html',
    styleUrls: ['./nechto-card.component.scss']
})
export class NechtoCardComponent {
    @Input()
    public card: NechtoCard;
    @Input()
    public location: CardLocation;
    @Input()
    public isDisabled = false;
    @Input()
    public isClickable = true;
    public NechtoCardType = NechtoCardType;
    public NechtoCardAction = NechtoCardAction;
    public CardLocation = CardLocation;
    public StepPhase = StepPhase;
    public GameActionGroup = GameActionGroup;
    public get canDrop() {
        return this.cardService.canDrop()
            && (
                (
                    this.isHand
                    && this.gameService.hasStepPhase(StepPhase.DropFromHand)
                    && this.gameService.getHandPartId(this.card.id) === this.gameService.getCurrentStepPlayerId()
                    && this.card.action !== NechtoCardAction.Event_Infection_It
                    && (
                        this.card.subType !== NechtoCardSubType.Infection
                        || !this.gameService.isInfected()
                        // Has at least 2 `Infection`s
                        || this.gameService.getHand().filter((item) => item.subType === NechtoCardSubType.Infection).length >= 2
                    )
                    && (
                        !this.gameService.hasStepPhases(StepPhase.ProcessPanic)
                        || (
                            !this.gameService.getActivePanicCard()
                            || ![
                                NechtoCardAction.Panic_ChainReaction,
                                NechtoCardAction.Panic_BlindDate
                            ].includes(this.gameService.getActivePanicCard().action)
                            || this.gameService.lastCard.id !== this.card.id
                        )
                    )
                    && (
                        !this.gameService.hasStepPhases(StepPhase.ProcessEvent)
                        || (
                            !this.gameService.getActiveEventCard()
                            || (
                                this.gameService.getActiveEventCard().action !== NechtoCardAction.Event_Action_Persistence
                                || this.cardPosition > this.cardService.MAX_HAND_CARDS - 1 // only new cards are droppable
                            )
                        )
                    )
                )
                || (
                    this.isTable
                    && this.gameService.hasStepPhase(StepPhase.DropFromTable)
                    && (
                        this.gameService.getTablePartId(this.card.id) === this.gameService.getCurrentStepPlayerId()
                        || [
                            this.card.requester,
                            this.card.eventRequester,
                            this.card.panicRequester
                        ].includes(this.gameService.getCurrentStepPlayerId())
                    )
                    && (
                        !this.gameService.hadStepPhase(StepPhase.DefenceFromHand)
                        || this.card.id === this.gameService.lastCard.id
                    )
                )
            );
    }
    public get canTake() {
        return (
            this.cardService.canTake(this.getTakeStepPhases())
            && (
                this.gameService.lastCard.action !== NechtoCardAction.Event_Action_Suspicion
                || this.gameService.getHandPartId(this.card.id) === this.gameService.getTablePartId(this.gameService.lastCard.id)
            )
        );
    }
    public get canPlay() {
        return this.cardService.canPlay()
            && (
                (
                    this.isHand
                    && this.gameService.getHandPartId(this.card.id) === this.gameService.getCurrentStepPlayerId()
                    && this.card.subType !== NechtoCardSubType.Infection
                    && (
                        (
                            this.gameService.hasStepPhase(StepPhase.PlayFromHand)
                            && this.card.subType !== NechtoCardSubType.Defence
                            && (
                                this.card.action !== NechtoCardAction.Event_Action_SwapPlaces
                                || this.gameService.canExchange(this.gameService.getPreviousPlayer().playerId)
                                || this.gameService.canExchange(this.gameService.getNextPlayer().playerId)
                            )
                            && (
                                ![
                                    NechtoCardAction.Event_Action_RunAway,
                                    NechtoCardAction.Event_Action_Axe
                                ].includes(this.card.action)
                                || !!this.checkReceivingPlayers(StepPhase.PlayFromHand, this.card.action).length
                            )
                            && (
                                ![
                                    NechtoCardAction.Event_Action_Temptation,
                                    NechtoCardAction.Event_Action_Analysis,
                                    NechtoCardAction.Event_Action_Suspicion,
                                    NechtoCardAction.Event_Action_Flamethrower
                                ].includes(this.card.action)
                                || this.receivingPlayers.length >= 1
                            )
                        )
                        || (
                            this.gameService.hasStepPhase(StepPhase.DefenceFromHand)
                            && this.card.subType === NechtoCardSubType.Defence
                            && (
                                !this.gameService.hasStepPhase(StepPhase.ProcessPanic)
                                || (
                                    !this.gameService.getActivePanicCard()
                                    || this.gameService.getActivePanicCard().action !== NechtoCardAction.Panic_ChainReaction
                                )
                            )
                            && (
                                this.card.action !== NechtoCardAction.Event_Defence_GoodHere
                                || (
                                    [
                                        NechtoCardAction.Event_Action_SwapPlaces,
                                        NechtoCardAction.Event_Action_RunAway
                                    ].includes(this.gameService.lastCard.action)
                                )
                            )
                            && (
                                this.card.action !== NechtoCardAction.Event_Defence_NoBarbecue
                                || this.gameService.lastCard.action === NechtoCardAction.Event_Action_Flamethrower
                            )
                            && (
                                ![
                                    NechtoCardAction.Event_Defence_NoThanks,
                                    NechtoCardAction.Event_Defence_Fear,
                                    NechtoCardAction.Event_Defence_Miss
                                ].includes(this.card.action)
                                || !!this.gameService.getActiveRequestedCard()
                            )
                        )
                    )
                    && (
                        !this.gameService.hasQuarantine(this.gameService.getCurrentStepPlayerId())
                        || this.card.action === NechtoCardAction.Event_Action_Axe
                    )
                )
                || (
                    this.isTable
                    && this.gameService.hasStepPhase(StepPhase.PlayFromTable)
                    && (
                        ![
                            NechtoCardAction.Event_Action_SwapPlaces,
                            NechtoCardAction.Panic_GoAway,
                            NechtoCardAction.Panic_OneTwo
                        ].includes(this.card.action)
                        || this.receivingPlayers.length >= 1
                    )
                    && this.card.action !== NechtoCardAction.Event_Obstacle_Quarantine
                )
            );
    }
    public get canGive() {
        return this.cardService.canGive()
            && this.card.action !== NechtoCardAction.Event_Infection_It
            && (
                (
                    this.isHand
                    && this.gameService.hasAnyOfStepPhases(
                        StepPhase.GiveToNextPlayer,
                        StepPhase.GiveToPreviousPlayer,
                        StepPhase.GiveToPlayer,
                        StepPhase.GiveToSpecificPlayer)
                    && this.gameService.getHandPartId(this.card.id) === this.gameService.getCurrentStepPlayerId()
                    && (
                        this.card.subType !== NechtoCardSubType.Infection
                        || (
                            this.gameService.isIt()
                            // Has 1 `Nechto` & at least 1 `Infection`s
                            && this.gameService.getHand().filter((item) => item.subType === NechtoCardSubType.Infection).length >= 2
                        )
                        || (
                            this.gameService.isInfected()
                            // Has at least 2 `Infection`s
                            && this.gameService.getHand().filter((item) => item.subType === NechtoCardSubType.Infection).length >= 2
                            && (
                                this.gameService.hasStepPhase(StepPhase.GiveToPlayer)
                                || (
                                    this.gameService.hasStepPhase(StepPhase.GiveToNextPlayer)
                                    && this.gameService.getNextPlayer()
                                    && this.gameService.isIt(this.gameService.getNextPlayer().playerId)
                                )
                                || (
                                    this.gameService.hasStepPhase(StepPhase.GiveToPreviousPlayer)
                                    && this.gameService.getActiveRequester()
                                    && this.gameService.isIt(this.gameService.getActiveRequester().playerId)
                                )
                                || (
                                    this.gameService.hasStepPhase(StepPhase.GiveToSpecificPlayer)
                                    && this.gameService.isIt(this.gameService.getTablePartId(this.gameService.lastCard.id))
                                )
                            )
                        )
                    )
                    && (
                        !this.gameService.hasStepPhase(StepPhase.ProcessPanic)
                        || (
                            !this.gameService.getActivePanicCard()
                            || (
                                this.gameService.getActivePanicCard().action !== NechtoCardAction.Panic_ChainReaction
                                || this.card.id !== this.gameService.lastCard.id
                            )
                        )
                    )
                )
                || (
                    this.isTable
                    && this.gameService.hasStepPhase(StepPhase.ReturnToPlayer)
                    && !!this.card.requester
                )
            )
            && this.receivingPlayers.length >= 1;
    }
    public get canView() {
        return this.card
            && (
                this.isGameFinished
                || (
                    (
                        this.card.sharedWithPlayerId === this.gameService.getActivePlayerId()
                        && (
                            !this.isTable
                            || this.gameService.getTablePartId(this.card.id) === this.gameService.getCurrentStepPlayerId()
                        )
                    )
                    || (
                        !this.card.hidden
                        && !this.isPickMode
                    )
                )
                || this.location === CardLocation.Info
            );
    }
    public get hasManyActions() {
        return [this.canDrop, this.canTake, this.canPlay, this.canGive].filter((action) => action).length > 1;
    }
    public get hasAnyAction() {
        return this.isClickable && (this.canDrop || this.canTake || this.canPlay || this.canGive);
    }
    public get isCardDisabled() {
        return this.isDisabled && this.location !== CardLocation.Info;
    }
    public get tooltipTemplate() {
        let classList = 'smth-card smth-card-selected';
        if (!this.canView) {
            classList += ' smth-card-back';
        }
        if (this.isCardDisabled) {
            classList += ' smth-card-disabled';
        }

        // TODO: remove debug data
        return this.sanitizer.bypassSecurityTrustHtml(`
            <div class="smth-card-tooltip">
                <div class="d-flex justify-content-center font-weight-bold smth-card-action-info">
                    ${this.canPlay && this.isCurrentPlayerTakingStep ?
                        '<h5 class="mb-0 px-1"><span class="badge badge-secondary text-uppercase">PLAY</span></h5>' : ''}
                    ${this.canTake && this.isCurrentPlayerTakingStep ?
                        `<h5 class="mb-0 px-1"><span class="badge badge-secondary text-uppercase">
                            ${this.getActionName(GameActionGroup.Take)}
                        </span></h5>` : ''}
                    ${this.canDrop && this.isCurrentPlayerTakingStep ?
                        '<h5 class="mb-0 px-1"><span class="badge badge-secondary text-uppercase">DROP</span></h5>' : ''}
                    ${this.canGive && this.isCurrentPlayerTakingStep ?
                        '<h5 class="mb-0 px-1"><span class="badge badge-secondary text-uppercase">GIVE</span></h5>' : ''}
                </div>

                <div class="${classList}" data-type="${this.card.type}" data-action="${this.card.action}">
                    <div style="background:#000;position:absolute;bottom:0;left:0;width:100%">
                        ${isNil(this.canPlay) || isNil(this.canTake) || isNil(this.canDrop) || isNil(this.canGive) || isNil(this.canView) ?
                `
                                <span>_____________</h5>
                                <h5>Possible Issues</h5>
                                ${isNil(this.canPlay) ? `<p style="margin: 0">canPlay: ${this.canPlay}</p>` : ''}
                                ${isNil(this.canTake) ? `<p style="margin: 0">canTake: ${this.canTake}</p>` : ''}
                                ${isNil(this.canDrop) ? `<p style="margin: 0">canDrop: ${this.canDrop}</p>` : ''}
                                ${isNil(this.canGive) ? `<p style="margin: 0">canGive: ${this.canGive}</p>` : ''}
                                ${isNil(this.canView) ? `<p style="margin: 0">canView: ${this.canView}</p>` : ''}
                            ` : ''
            }
                    </div>
                </div>
            </div>
        `);
    }
    public get isHand() {
        return this.location === CardLocation.Hand;
    }
    public get isDeck() {
        return this.location === CardLocation.Deck;
    }
    public get isTable() {
        return this.location === CardLocation.Table;
    }
    public get isTrash() {
        return this.location === CardLocation.Trash;
    }
    public get isBorder() {
        return this.location === CardLocation.Border;
    }
    public get isCurrentPlayerTakingStep() {
        return this.gameService.isTakingStep(this.gameService.getActivePlayerId(), true);
    }
    public get filteredReceivingPlayers() {
        return this.receivingPlayers.filter((player) => !!player);
    }
    public get isGameFinished() {
        return this.roomService.isGameFinished();
    }
    public get isBotPlaying() {
        return this.gameService.isBotPlaying;
    }
    private get receivingPlayers(): NechtoPlayerComponent[] {
        if (!this.gameService.getActivePlayerComponents().length) {
            return [];
        }

        const currentStepPlayerId = this.gameService.getCurrentStepPlayerId();
        const allPlayers = this.gameService.getActivePlayerComponents();
        const otherPlayers = allPlayers.filter((item) => item.playerId !== currentStepPlayerId);
        const currentPlayer = this.gameService.getPlayerComponent(currentStepPlayerId);
        const activePanicCard = this.gameService.getActivePanicCard();

        if (this.hasStepPhase(StepPhase.GiveToPlayer)) {
            const selectedPlayers: NechtoPlayerComponent[] = [];

            if (this.gameService.hasStepPhase(StepPhase.ProcessPanic) && activePanicCard) {
                switch (activePanicCard.action) {
                    case NechtoCardAction.Panic_Friends:
                        selectedPlayers.push(...otherPlayers);
                        return selectedPlayers.filter((player) => {
                            return !this.gameService.hasQuarantine(player.playerId);
                        });
                    default:
                        selectedPlayers.push(...otherPlayers);
                        break;
                }
            } else {
                selectedPlayers.push(...otherPlayers);
            }

            return selectedPlayers;
        } else if (this.hasStepPhase(StepPhase.GiveToNextPlayer)) {
            return [this.gameService.getNextPlayer()];
        } else if (this.hasAnyOfStepPhases(StepPhase.GiveToPreviousPlayer, StepPhase.DefenceFromHand, StepPhase.ReturnToPlayer)) {
            const requester = this.gameService.getActiveRequester();
            return requester ? [requester] : [];
        } else if (this.hasStepPhase(StepPhase.GiveToSpecificPlayer)) {
            return [this.gameService.getPlayerComponent(this.gameService.getTablePartId(this.gameService.lastCard.id))];
        } else if (this.hasStepPhase(StepPhase.PlayFromHand)) {
            const previousPlayer = this.gameService.getPreviousPlayer();
            const nextPlayer = this.gameService.getNextPlayer();

            let selectedPlayers: NechtoPlayerComponent[] = [];
            const ignoreQuarantines = false;
            const ignoreLockedDoors = false;

            switch (this.card.action) {
                case NechtoCardAction.Event_Obstacle_LockedDoor:
                case NechtoCardAction.Event_Action_Flamethrower:
                case NechtoCardAction.Event_Action_Analysis:
                case NechtoCardAction.Event_Action_Suspicion:
                    selectedPlayers.push(previousPlayer, nextPlayer);
                    break;

                case NechtoCardAction.Event_Obstacle_Quarantine:
                    selectedPlayers.push(previousPlayer, currentPlayer, nextPlayer);
                    break;

                case NechtoCardAction.Event_Action_RunAway:
                case NechtoCardAction.Event_Action_SwapPlaces:
                case NechtoCardAction.Event_Action_Whiskey:
                case NechtoCardAction.Event_Action_LookAround:
                case NechtoCardAction.Event_Action_Persistence:
                case NechtoCardAction.Event_Action_Axe:
                    return [];

                case NechtoCardAction.Event_Action_Temptation:
                    selectedPlayers.push(...otherPlayers);
                    break;

                default:
                    selectedPlayers.push(...allPlayers);
                    break;
            }

            // Remove players in quarantine and players with locked door
            selectedPlayers = selectedPlayers
                .filter((player) => {
                    return this.gameService.canExchange(player.playerId, ignoreQuarantines, ignoreLockedDoors);
                })
                .filter((player) => player.hasPlayer);

            return selectedPlayers;
        } else if (this.hasStepPhase(StepPhase.PlayFromTable)) {
            const previousPlayer = this.gameService.getPreviousPlayer();
            const nextPlayer = this.gameService.getNextPlayer();

            let selectedPlayers: NechtoPlayerComponent[] = [];
            const ignoreQuarantines = false;
            let ignoreLockedDoors = false;
            let ignoreSelfQuarantine = false;

            switch (this.card.action) {
                case NechtoCardAction.Event_Action_RunAway:
                case NechtoCardAction.Panic_GoAway:
                    selectedPlayers.push(...otherPlayers);
                    ignoreLockedDoors = true;
                    ignoreSelfQuarantine = true;
                    break;

                case NechtoCardAction.Event_Action_LookAround:
                case NechtoCardAction.Panic_OldRopes:
                case NechtoCardAction.Panic_IsItParty:
                case NechtoCardAction.Panic_Oops:
                case NechtoCardAction.Panic_ThreeFour:
                    return [];

                case NechtoCardAction.Event_Action_Axe:
                    selectedPlayers.push(previousPlayer, currentPlayer, nextPlayer);
                    return selectedPlayers
                        .filter((player) => {
                            if (player.playerId === currentPlayer.playerId) { // Self-check
                                return this.gameService.hasQuarantine(player.playerId)
                                    || this.gameService.hasAnyLockedDoor(player.playerId);
                            } else { // Check neighbor player
                                return this.gameService.hasQuarantine(player.playerId)
                                    || this.gameService.hasLockedDoor(player.playerId, currentPlayer.playerId);
                            }
                        });

                case NechtoCardAction.Event_Action_SwapPlaces:
                    selectedPlayers.push(previousPlayer, nextPlayer);
                    ignoreSelfQuarantine = true;
                    break;

                case NechtoCardAction.Panic_BetweenUs:
                    ignoreSelfQuarantine = true;
                    return [previousPlayer, nextPlayer].filter((player) => player.hasPlayer);

                case NechtoCardAction.Panic_OneTwo:
                    const thirdPreviousPlayer = this.gameService.getPreviousPlayer(
                        this.gameService.getPreviousPlayer(
                            previousPlayer.playerId
                        ).playerId
                    );
                    const thirdNextPlayer = this.gameService.getNextPlayer(
                        this.gameService.getNextPlayer(
                            nextPlayer.playerId
                        ).playerId
                    );
                    selectedPlayers.push(thirdPreviousPlayer, thirdNextPlayer);
                    ignoreLockedDoors = true;
                    ignoreSelfQuarantine = true;
                    break;

                default:
                    selectedPlayers.push(...allPlayers);
                    break;
            }

            // Remove players in quarantine and players with locked door (if needed)
            selectedPlayers = selectedPlayers
                .filter((player) => {
                    return this.gameService.canExchange(player.playerId, ignoreQuarantines, ignoreLockedDoors, ignoreSelfQuarantine);
                })
                .filter((player) => player.hasPlayer);

            return selectedPlayers;
        } else {
            return [];
        }
    }
    private get cardPosition() {
        if (this.isHand) {
            const hand = this.gameService.getHand(this.gameService.getHandPartId(this.card.id));
            return hand.findIndex((item) => item.id === this.card.id);
        } else if (this.isTable) {
            const table = this.gameService.getTable(this.gameService.getTablePartId(this.card.id));
            return table.findIndex((item) => item.id === this.card.id);
        }
    }
    private get isPickMode() {
        return this.isHand
            && (
                this.gameService.hasStepPhase(StepPhase.PickFromHand)
                || this.gameService.hadStepPhase(StepPhase.PickFromHand)
            )
            && this.gameService.getActiveEventCard()
            && this.gameService.getHandPartId(this.card.id) === this.gameService.getTablePartId(this.gameService.getActiveEventCard().id)
            && (
                (
                    !this.isBotPlaying
                    && this.gameService.getActivePlayerId() === this.gameService.getActiveEventCard().eventRequester
                )
                || (
                    this.roomService.isBotManager(this.userService.getCurrentUserId())
                    && this.isBotPlaying
                    && this.gameService.getCurrentStepPlayerId() === this.gameService.getActiveEventCard().eventRequester
                )
            );
    }

    constructor(
        private readonly sanitizer: DomSanitizer,
        private readonly cardService: CardService,
        private readonly gameService: GameService,
        private readonly roomService: RoomService,
        private readonly translateService: TranslateService,
        private readonly userService: UserService
    ) { }

    public playCard(playerId?: number) {
        if (this.isCardDisabled || !this.isClickable) {
            return;
        }

        if (this.isHand) {
            return this.cardService.playHandCard(this.card.id, playerId).subscribe();
        } else if (this.isTable) {
            return this.cardService.playTableCard(this.card.id, playerId).subscribe();
        }
    }

    public takeCard() {
        if (this.isCardDisabled || !this.isClickable) {
            return;
        }

        if (this.isDeck) {
            return this.cardService.takeDeckCard(this.card.id).subscribe();
        } else if (this.isHand) {
            return this.cardService.takeHandCard(this.card.id).subscribe();
        }
    }

    public dropCard() {
        if (this.isCardDisabled || !this.isClickable) {
            return;
        }

        if (this.isHand) {
            return this.cardService.dropHandCard(this.card.id).subscribe();
        } else if (this.isTable) {
            return this.cardService.dropTableCard(this.card.id).subscribe();
        }
    }

    public giveCard(playerId: number) {
        if (this.isCardDisabled || !this.isClickable) {
            return;
        }

        if (this.isHand) {
            return this.cardService.giveHandCard(this.card.id, playerId).subscribe();
        } else if (this.isTable) {
            return this.cardService.giveTableCard(this.card.id, playerId).subscribe();
        }
    }

    public processCard() {
        if (this.canDrop) {
            this.dropCard();
        } else if (this.canTake) {
            this.takeCard();
        }
    }

    public hasStepPhase(stepPhase: StepPhase) {
        return this.gameService.hasStepPhase(stepPhase);
    }

    public hasAnyOfStepPhases(...stepPhases: StepPhase[]) {
        return this.gameService.hasAnyOfStepPhases(...stepPhases);
    }

    public getActionName(actionGroup: GameActionGroup) {
        let key: string;

        switch (actionGroup) {
            case GameActionGroup.Take:
                key = this.isPickMode ? 'PICK' : 'TAKE';
                break;
            case GameActionGroup.Play:
                key = 'PLAY';
                break;
            case GameActionGroup.Drop:
                key = 'DROP';
                break;
            case GameActionGroup.Give:
                key = 'GIVE';
                break;
            default:
                key = '';
                break;
        }

        return this.translateService.instant(`i18n.ACTION_GROUPS.${key}`);
    }

    private checkReceivingPlayers(stepPhase: StepPhase, action: NechtoCardAction): NechtoPlayerComponent[] {
        const currentStepPlayerId = this.gameService.getCurrentStepPlayerId();
        const allPlayers = this.gameService.getActivePlayerComponents();
        const otherPlayers = allPlayers.filter((item) => item.playerId !== currentStepPlayerId);
        const currentPlayer = this.gameService.getPlayerComponent(currentStepPlayerId);
        const previousPlayer = this.gameService.getPreviousPlayer();
        const nextPlayer = this.gameService.getNextPlayer();
        let selectedPlayers: NechtoPlayerComponent[] = [];
        const ignoreQuarantines = false;
        let ignoreLockedDoors = false;

        switch (stepPhase) {
            case StepPhase.PlayFromHand:
            default:
                switch (action) {
                    case NechtoCardAction.Event_Action_RunAway:
                        selectedPlayers.push(...otherPlayers);
                        ignoreLockedDoors = true;
                        break;

                    case NechtoCardAction.Event_Action_Axe:
                        selectedPlayers.push(previousPlayer, currentPlayer, nextPlayer);
                        return selectedPlayers.filter((player) => {
                            if (player.playerId === currentPlayer.playerId) { // Self-check
                                return this.gameService.hasQuarantine(player.playerId)
                                    || this.gameService.hasAnyLockedDoor(player.playerId);
                            } else { // Check neighbor player
                                return !this.gameService.canExchange(player.playerId);
                            }
                        });

                    default: return [];
                }

                // Remove players in quarantine and players with locked door (if needed)
                selectedPlayers = selectedPlayers.filter((player) => {
                    return this.gameService.canExchange(player.playerId, ignoreQuarantines, ignoreLockedDoors);
                });

                return selectedPlayers;
        }
    }

    private getTakeStepPhases(): TakeStepPhase[] {
        switch (this.location) {
            case CardLocation.Deck: return [StepPhase.TakeFromDeck, StepPhase.FulfillHandFromDeck];
            case CardLocation.Hand: return [StepPhase.PickFromHand];
            case CardLocation.Trash:
            case CardLocation.Table:
            default:
                return [];
        }
    }
}
