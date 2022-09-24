import { ChangeDetectorRef, Component, OnInit, ViewChild, ViewChildren } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { html, stripIndents } from 'common-tags';
import { interval, of, combineLatest } from 'rxjs';
import { switchMap, tap, filter, map } from 'rxjs/operators';

import { BotService } from '../../../../../../core/services/bot.service';
import { GameInfoService } from '../../../../../../core/services/game-info.service';
import { GameService } from '../../../../../../core/services/game.service';
import { PeerService } from '../../../../../../core/services/peer.service';
import { RoomService } from '../../../../../../core/services/room.service';
import { UserService } from '../../../../../../core/services/user.service';
import { StepInfoDto } from '../../../../../../models/dtos/step-info-dto.model';
import { CardLocation } from '../../../../../../models/enums/card-location.enum';
import { Direction } from '../../../../../../models/enums/direction.enum';
import { Game } from '../../../../../../models/enums/game.enum';
import { NechtoCardAction } from '../../../../../../models/enums/nechto-card-action.enum';
import { StepPhase } from '../../../../../../models/enums/step-phase.enum';
import { GameComponent } from '../../../../components/game/game.component';
import { NechtoPlayerComponent } from '../nechto-player/nechto-player.component';
import { NechtoTableComponent } from '../nechto-table/nechto-table.component';
import { AudioHelpers } from '../../../../../../core/helpers/audio.helpers';
import { SoundEffect } from '../../../../../../models/enums/sound-effect.enum';

@Component({
    selector: 'gw-nechto',
    templateUrl: './nechto.component.html',
    styleUrls: ['./nechto.component.scss']
})
export class NechtoComponent extends GameComponent implements OnInit {
    @ViewChildren(NechtoPlayerComponent)
    public set players(content: NechtoPlayerComponent[]) {
        this.gameService.setPlayerComponents(content);
        this.cdr.detectChanges();
    }
    @ViewChild(NechtoTableComponent)
    public set table(content: NechtoTableComponent) {
        this.gameService.setTableComponent(content);
    }
    public selectedGame = Game.Nechto;
    public CardLocation = CardLocation;
    public html = html;
    public stripIndents = stripIndents;
    public get isGameMode() {
        return this.roomService.isGameMode();
    }
    public get isGameFinished() {
        return this.roomService.isGameFinished();
    }
    public get currentStepPlayer() {
        return this.gameService.getPlayerComponent(this.gameService.currentGame.currentStepPlayerId);
    }
    public get currentStepPhases() {
        return this.gameService.currentStepPhases;
    }
    public get formattedStepInfo() {
        if (!this.lastStepInfo) {
            return null;
        }

        return this.sanitizer.bypassSecurityTrustHtml(
            this.gameInfoService.getFormattedStepInfo(this.lastStepInfo)
        );
    }
    public get formattedGameDirection() {
        return this.sanitizer.bypassSecurityTrustHtml(
            this.gameInfoService.getFormattedGameDirection(this.gameService.currentGame.direction || Direction.Clockwise)
        );
    }
    public get activeEventCard() {
        return this.gameService.getActiveEventCard();
    }
    public get activePanicCard() {
        return this.gameService.getActivePanicCard();
    }
    public get hasActiveEventCard() {
        return !!this.activeEventCard;
    }
    public get hasActivePanicCard() {
        return !!this.activePanicCard;
    }
    public get activeCard() {
        if (this.hasActiveEventCard) {
            return this.activeEventCard;
        } else if (this.hasActivePanicCard) {
            return this.activePanicCard;
        } else {
            return null;
        }
    }
    public get hasAnyActiveCard() {
        return this.hasActiveEventCard || this.hasActivePanicCard;
    }
    private get isBotManager() {
        return this.hasSelectedRoom && this.roomService.isBotManager(this.userService.getCurrentUserId());
    }
    private lastStepInfo: StepInfoDto;

    constructor(
        protected readonly activatedRoute: ActivatedRoute,
        protected readonly gameService: GameService,
        protected readonly roomService: RoomService,
        protected readonly botService: BotService,
        protected readonly router: Router,
        protected readonly userService: UserService,
        private readonly peerService: PeerService,
        private readonly gameInfoService: GameInfoService,
        private readonly sanitizer: DomSanitizer,
        private readonly cdr: ChangeDetectorRef,
        private readonly audioHelpers: AudioHelpers
    ) {
        super(activatedRoute, gameService, roomService, botService, router, userService);
    }

    public ngOnInit() {
        super.ngOnInit();

        this.subscription.add(
            this.peerService.createOrRestorePeer(true).subscribe()
        );

        this.subscription.add(
            this.gameInfoService.stepsInfo$
                .subscribe(() => {
                    this.lastStepInfo = this.gameInfoService.getStepInfo(this.roomService.getSelectedRoomId());
                })
        );

        this.subscription.add(
            this.gameService.currentGame$
                .pipe(
                    filter((currentGame) => !!currentGame),
                    filter((currentGame) => {
                        return currentGame.currentStepPhases.some((item) => !currentGame.previousStepPhases.includes(item))
                            || currentGame.previousStepPhases.some((item) => !currentGame.currentStepPhases.includes(item));
                    }),
                    map((currentGame) => {
                        // Play the audio effect for the finished step
                        this.audioHelpers.playSound(SoundEffect.StepEnd);

                        const playerId = this.gameService.getActivePlayerId();
                        if (currentGame.previousStepPlayerId !== currentGame.currentStepPlayerId
                            && currentGame.currentStepPlayerId === playerId) {
                            // Play the sound in timeout, so we will not hear both step end and step start
                            setTimeout(() => this.audioHelpers.playSound(SoundEffect.StepStart), 300);
                        }
                    })
                )
                .subscribe()
        );

        this.subscription.add(
            interval(this.botService.botProcessingInterval)
                .pipe(
                    switchMap(() => {
                        // If current player is a bot - process its logic.
                        // We also need to do this from only one machine, so it will be a room author for now.
                        if (this.isBotManager
                            && !this.isGameFinished
                            && this.gameService.isBotTakingStep()
                            && !this.botService.isProcessingBotStep) {

                            return this.botService.processBotStep();
                        } else {
                            return of(true);
                        }
                    })
                )
                .subscribe()
        );
    }

    public getFormattedStepPhase(stepPhase: StepPhase) {
        return this.gameInfoService.getFormattedStepPhase(stepPhase);
    }

    public getFormattedAction(action: NechtoCardAction) {
        return this.gameInfoService.getFormattedAction(action);
    }

    public getPlayerComponents(playerIds: number[]) {
        if (this.isGameMode) {
            const activePlayers = this.roomService.getRoomMembers(this.roomService.getSelectedRoomId()).map((item) => item.playerId);
            return playerIds.filter((item) => activePlayers.includes(item));
        } else {
            const selectedRoom = this.roomService.getSelectedRoom();
            return playerIds.filter((item) => !selectedRoom.maxQuantity || item <= selectedRoom.maxQuantity);
        }
    }

    public getPositioningClass(row: number) {
        if (this.isGameMode) {
            return 'justify-content-center';
        } else if (row === 2) {
            return 'justify-content-between';
        } else {
            return 'justify-content-around';
        }
    }
}
