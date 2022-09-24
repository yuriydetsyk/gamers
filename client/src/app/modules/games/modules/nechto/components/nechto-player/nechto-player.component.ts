import { Component, Input, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { combineLatest, EMPTY, forkJoin, Observable, Subject } from 'rxjs';
import { finalize, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';

import { isNil } from '../../../../../../core/helpers/type.helpers';
import { CardService } from '../../../../../../core/services/card.service';
import { GameInfoService } from '../../../../../../core/services/game-info.service';
import { GameService } from '../../../../../../core/services/game.service';
import { LocalStorageService } from '../../../../../../core/services/local-storage.service';
import { MediaService } from '../../../../../../core/services/media.service';
import { RatingService } from '../../../../../../core/services/rating.service';
import { RoomService } from '../../../../../../core/services/room.service';
import { UserService } from '../../../../../../core/services/user.service';
import { PlayerDto } from '../../../../../../models/dtos/player-dto.model';
import { UserDto } from '../../../../../../models/dtos/user-dto.model';
import { CardLocation } from '../../../../../../models/enums/card-location.enum';
import { Direction } from '../../../../../../models/enums/direction.enum';
import { NechtoCardAction } from '../../../../../../models/enums/nechto-card-action.enum';
import { NechtoCardSubType } from '../../../../../../models/enums/nechto-card-sub-type.enum';
import { NechtoCardType } from '../../../../../../models/enums/nechto-card-type.enum';
import { StepPhase } from '../../../../../../models/enums/step-phase.enum';
import { StorageKey } from '../../../../../../models/enums/storage-key.enum';
import { UserLevel } from '../../../../../../models/enums/user-level.enum';
import { NechtoCard } from '../../../../../../models/nechto-card.model';
import { NechtoCardComponent } from '../nechto-card/nechto-card.component';
import { AudioHelpers } from '../../../../../../core/helpers/audio.helpers';

@Component({
    selector: 'gw-nechto-player',
    templateUrl: './nechto-player.component.html',
    styleUrls: ['./nechto-player.component.scss']
})
export class NechtoPlayerComponent implements OnInit, OnDestroy {
    @Input()
    public playerId: number;
    public player: PlayerDto;
    public user: UserDto;
    public playerStream: MediaStream;
    public NechtoCardType = NechtoCardType;
    public isConfiguringStream = false;
    public CardLocation = CardLocation;
    public Direction = Direction;
    public UserLevel = UserLevel;
    public get peerId() {
        return this.player ? this.player.peerId : null;
    }
    public set peerId(id: string) {
        if (this.player) {
            this.player.peerId = id;
        }
    }
    public get game() {
        return this.gameService.currentGame;
    }
    public get isVideoMuted() {
        return this.player ? this.player.isVideoMuted : false;
    }
    public get isAudioMuted() {
        return this.player ? this.player.isAudioMuted : false;
    }
    public get isFullScreenMode() {
        const isFullScreen = this.localStorageService.get(StorageKey.VideoFullScreen);
        return !isNil(isFullScreen) ? isFullScreen : false;
    }
    public get showUserLevels() {
        const showLevels = this.localStorageService.get(StorageKey.UserLevelsVisibility);
        return !isNil(showLevels) ? showLevels : true;
    }
    public get hasAudioEffects() {
        return !!this.audioHelpers.hasAudioEffects;
    }
    @ViewChildren(NechtoCardComponent)
    public cardComponents: QueryList<NechtoCardComponent>;
    public get isGameMode() {
        return this.roomService.isGameMode();
    }
    public get hasStream() {
        return !isNil(this.playerStream);
    }
    public get hasBlockedStream() {
        if (this.hasCurrentPlayer) {
            return this.mediaService.hasBlockedStream;
        } else if (this.hasPlayer) {
            return !this.isBot && !this.hasStream && !this.player.videoId && !this.player.audioId;
        } else {
            return false;
        }
    }
    public get canResetStream() {
        const videoTracks = this.hasStream ? this.playerStream.getVideoTracks() : [];

        return !this.isConfiguringStream && (
            !this.hasStream
            || (videoTracks[0] && this.player.videoId && videoTracks[0].id !== this.player.videoId)
        );
    }
    public get hasPlayer() {
        return this.user && this.player;
    }
    public get hasCurrentPlayer() {
        return this.playerId === this.gameService.getActivePlayerId();
    }
    public get canTakePlace() {
        return isNil(this.gameService.getActivePlayerId()) && !this.hasPlayer;
    }
    public get hasCards() {
        if (isNil(this.game) || isNil(this.game.hands[this.playerId])) {
            return false;
        }

        return this.game.hands[this.playerId].length > 0;
    }
    public get handCards() {
        if (isNil(this.game)) {
            return [];
        }

        let handCards = this.game.hands[this.playerId];
        if (isNil(handCards)) {
            return [];
        }

        if (!this.isBot && !this.hasCurrentPlayer && !this.isGameFinished) {
            handCards = handCards.filter((item) => this.isShared(item) || this.isPickMode);
        }

        return handCards;
    }
    public get videoTracks() {
        return this.playerStream ? this.playerStream.getVideoTracks() : [];
    }
    public get audioTracks() {
        return this.playerStream ? this.playerStream.getAudioTracks() : [];
    }
    public get isVideoEnabled() {
        return !isNil(this.player.videoId);
    }
    public get isGameFinished() {
        return this.roomService.isGameFinished();
    }
    public get backgroundImage() {
        return this.sanitizer.bypassSecurityTrustStyle(`url(${this.user.getAvatarUrl()})`);
    }
    public get canSeeCards() {
        return (
            !!this.gameService.getActivePlayerId()
            && !this.isInactive
            && this.handCards.some((item) => this.isShared(item))
        )
        || this.isPickMode
        || this.isGameFinished;
    }
    public get canSeeBotCards() {
        return this.isBotManager && this.isBot;
    }
    public get isInactive() {
        return this.gameService.isInactive(this.playerId);
    }
    public get isIt() {
        return this.gameService.isIt(this.playerId);
    }
    public get currentUserId() {
        return this.userService.getCurrentUserId();
    }
    public get canShowCards() {
        return this.isTakingStep()
            && this.gameService.hasStepPhases(StepPhase.ShowFromHand)
            && (
                this.canSeeBotCards
                || this.playerId === this.gameService.getActivePlayerId()
            );
    }
    public get canShowInfection() {
        return this.isTakingStep() && this.handCards.some((item) => {
            return item.subType === NechtoCardSubType.Infection && item.action !== NechtoCardAction.Event_Infection_It;
        });
    }
    public get canAcceptRequest() {
        return this.isTakingStep()
            && this.gameService.hasStepPhase(StepPhase.AcceptRequest)
            && (
                this.canSeeBotCards
                || this.playerId === this.gameService.getActivePlayerId()
            );
    }
    public get isBot() {
        return this.hasPlayer && this.user.isBot;
    }
    public get hasExtraActions() {
        return this.canShowCards || this.canAcceptRequest;
    }
    public get isBotPlaying() {
        return this.gameService.isBotPlaying;
    }
    public get canSeeIt() {
        return !!this.gameService.getActivePlayerId()
            && !this.gameService.isHuman(this.gameService.getActivePlayerId())
            && !this.gameService.isInactive(this.gameService.getActivePlayerId());
    }
    public get isPickMode() {
        return (
            this.gameService.hasStepPhase(StepPhase.PickFromHand)
            || this.gameService.hadStepPhase(StepPhase.PickFromHand)
        )
            && this.gameService.getActiveEventCard()
            && this.playerId === this.gameService.getTablePartId(this.gameService.getActiveEventCard().id)
            && (
                (
                    !this.isBotPlaying
                    && this.gameService.getActivePlayerId() === this.gameService.getActiveEventCard().eventRequester
                )
                || (
                    this.isBotManager
                    && this.isBotPlaying
                    && this.gameService.getCurrentStepPlayerId() === this.gameService.getActiveEventCard().eventRequester
                )
            );
    }
    private get isBotManager() {
        return this.roomService.isBotManager(this.userService.getCurrentUserId());
    }

    private destroy$ = new Subject<void>();

    constructor(
        private readonly mediaService: MediaService,
        private readonly gameService: GameService,
        private readonly userService: UserService,
        private readonly cardService: CardService,
        private readonly roomService: RoomService,
        private readonly sanitizer: DomSanitizer,
        private readonly ratingService: RatingService,
        private readonly localStorageService: LocalStorageService,
        private readonly gameInfoService: GameInfoService,
        private readonly audioHelpers: AudioHelpers
    ) { }

    public ngOnInit() {
        combineLatest([
            this.userService.users$,
            this.roomService.roomMembers$
        ])
            .pipe(
                map(([users, roomMembers]) => {
                    if (!users || !roomMembers) {
                        this.user = null;
                        this.player = null;
                        return;
                    }

                    const selectedRoomId = this.roomService.getSelectedRoomId();

                    const player = roomMembers
                        .filter((roomMember) => roomMember.roomId === selectedRoomId)
                        .find((roomMember) => roomMember.playerId === this.playerId);
                    if (!player) {
                        this.user = null;
                        this.player = null;
                        return;
                    }

                    if (player.isBot) { // This can be not a real player
                        // We set bot data only once. It can be overriden only if bot swaps place with another player.
                        if (!this.user || this.user.id !== player.userId) {
                            setTimeout(() => {
                                this.user = new UserDto({
                                    id: player.userId,
                                    username: player.botName,
                                    gender: player.botGender,
                                    isBot: true
                                });
                            });
                        }
                    } else {
                        this.user = users.find((item) => item.id === player.userId) || null;
                    }

                    this.player = player;
                }),
                tap(() => {
                    if (this.hasCurrentPlayer && this.canResetStream) {
                        this.startStreaming();
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public takePlace() {
        if (this.hasCurrentPlayer) {
            return;
        }

        this.gameService.setActivePlayerId(this.playerId)
            .subscribe(() => this.startStreaming());
    }

    public leavePlace() {
        if (!this.hasCurrentPlayer) {
            return;
        }

        this.gameService.setActivePlayerId(null)
            .subscribe(() => {
                this.stopStreaming();
            });
    }

    public playHandCard(card: NechtoCard) {
        if (!this.isTakingStep()) {
            return;
        }

        this.cardService.playHandCard(card.id).subscribe();
    }

    public setVideoTrack(optionId: string) {
        if (this.player.videoId !== optionId) {
            this.mediaService.setVideoTrackId(optionId)
                .subscribe(() => this.videoTracks.forEach((item) => item.enabled = (item.id === optionId)));
        }
    }

    public setAudioTrack(optionId: string) {
        if (this.player.audioId !== optionId) {
            this.mediaService.setAudioTrackId(optionId)
                .subscribe(() => this.audioTracks.forEach((item) => item.enabled = (item.id === optionId)));
        }
    }

    public startStreaming(forceReset = false) {
        if (!this.canResetStream && !forceReset) {
            return;
        }

        this.isConfiguringStream = true;

        this.mediaService.getUserMedia()
            .pipe(
                take(1),
                switchMap((stream) => {
                    this.playerStream = stream;
                    if (!stream) { // Video & audio is blocked in the website
                        return this.mediaService.setTrackIds(null, null);
                    } else { // Video & audio is accessible - check if existing data is up-to-date
                        const obs$: Observable<any>[] = [];
                        if (!this.videoTracks.some((item) => item.id === this.player.videoId)) {
                            const videoTrackId = this.videoTracks[0] ? this.videoTracks[0].id : null;
                            if (videoTrackId) {
                                obs$.push(this.mediaService.setVideoTrackId(videoTrackId));
                            }
                        }
                        if (!this.audioTracks.some((item) => item.id === this.player.audioId)) {
                            const audioTrackId = this.audioTracks[0] ? this.audioTracks[0].id : null;
                            if (audioTrackId) {
                                obs$.push(this.mediaService.setAudioTrackId(audioTrackId));
                            }
                        }

                        if (obs$.length) {
                            return forkJoin(obs$);
                        } else {
                            return EMPTY;
                        }
                    }
                }),
                finalize(() => this.isConfiguringStream = false)
            )
            .subscribe(() => {
                this.gameService.playerStreamsUpdated$.next();
            });
    }

    public stopStreaming() {
        if (!this.playerStream) {
            return;
        }

        this.playerStream = null;
        this.gameService.playerStreamsUpdated$.next();
    }

    public toggleAudio() {
        let currentAudioTrack: MediaStreamTrack;

        if (this.player.audioId) {
            currentAudioTrack = this.audioTracks.find((item) => item.id === this.player.audioId);
            // currentAudioTrack.enabled = !currentAudioTrack.enabled;

            this.mediaService.toggleMedia({ toggleAudio: true })
                .subscribe(() => this.gameService.playerStreamsUpdated$.next());
        } else {
            const newAudioTrack = this.audioTracks[0];
            if (newAudioTrack) {
                newAudioTrack.enabled = true;
            }

            this.mediaService.setAudioTrackId(newAudioTrack.id)
                .subscribe(() => this.gameService.playerStreamsUpdated$.next());
        }
    }

    // TODO: add ability to stream with only audio
    public toggleVideo() {
        let currentVideoTrack: MediaStreamTrack;

        if (this.player.videoId) {
            currentVideoTrack = this.videoTracks.find((item) => item.id === this.player.videoId);
            // currentVideoTrack.enabled = !currentVideoTrack.enabled;

            this.mediaService.toggleMedia({ toggleVideo: true })
                .subscribe(() => this.gameService.playerStreamsUpdated$.next());
        } else {
            const newVideoTrack = this.videoTracks[0];
            if (newVideoTrack) {
                newVideoTrack.enabled = true;
            }

            this.mediaService.setVideoTrackId(newVideoTrack.id)
                .subscribe(() => this.gameService.playerStreamsUpdated$.next());
        }

    }

    public getFilteredBorderCards(borderDirection: Direction) {
        if (!this.game || !this.gameService.getActivePlayerComponents(false, false).length) {
            return [];
        }

        const borderCards = this.game.borders[this.playerId];
        if (!borderCards) {
            return [];
        }

        const previousPlayerId = this.gameService.getPreviousPlayer(this.playerId).playerId;
        const nextPlayerId = this.gameService.getNextPlayer(this.playerId).playerId;

        if (previousPlayerId !== nextPlayerId) {
            return borderCards.filter((item) => {
                return borderDirection === Direction.Clockwise ? item.blockFrom === nextPlayerId : item.blockFrom === previousPlayerId;
            });
        } else { // Only two players are left
            return borderCards.filter((item) => {
                return borderDirection === Direction.Clockwise ? item.blockFrom > this.playerId : item.blockFrom < this.playerId;
            });
        }
    }

    public showCards(showAll = true) {
        this.cardService.showCards(showAll).subscribe();
    }

    public skipShowingCards() {
        this.cardService.skipShowingCards().subscribe();
    }

    public acceptRequest() {
        this.cardService.acceptRequest().subscribe();
    }

    public isTakingStep(ignoreBots = false) {
        return this.gameService.isTakingStep(this.playerId, ignoreBots);
    }

    public toggleFullScreenMode(isFullScreenMode: boolean) {
        this.localStorageService.set(StorageKey.VideoFullScreen, isFullScreenMode);
    }

    public toggleUserLevels(showLevels: boolean) {
        this.localStorageService.set(StorageKey.UserLevelsVisibility, showLevels);
    }

    public toggleAudioEffects(isEnabled: boolean) {
        this.audioHelpers.toggleAudioEffects(isEnabled);
    }

    public getUserLevel(userId: string) {
        return this.ratingService.getLevel(userId);
    }

    public getFormattedUserLevel(userId: string) {
        return this.gameInfoService.getFormattedUserLevel(this.getUserLevel(userId));
    }

    private isShared(card: NechtoCard) {
        return card.shared || card.sharedWithPlayerId === this.gameService.getActivePlayerId();
    }
}
