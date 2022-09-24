import { Injectable, OnDestroy } from '@angular/core';
import { defer, forkJoin, Observable, of, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { PlayerDto } from '../../models/dtos/player-dto.model';
import { isNil, isUndefined } from '../helpers/type.helpers';
import { FirebaseService } from './firebase.service';
import { RoomService } from './room.service';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class MediaService implements OnDestroy {
    public hasBlockedStream = false;
    private userMedia$: Observable<MediaStream>;
    private userMedia: MediaStream;
    private subscription = new Subscription();
    private needForceReload = false;
    private stubbedStream = new MediaStream([]);
    private mediaConstraints: MediaStreamConstraints = {
        video: {
            width: { ideal: 420, max: 1920 },
            height: { ideal: 236, max: 1080 },
            frameRate: { ideal: 15, max: 60 }
        },
        audio: {
            echoCancellation: true
        }
    };
    private fallbackMediaConstraints: MediaStreamConstraints = {
        video: true,
        audio: true
    };

    constructor(
        private readonly roomService: RoomService,
        private readonly userService: UserService,
        private readonly firebaseService: FirebaseService
    ) {
        this.initConstraints();
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public getUserMedia(constraints: MediaStreamConstraints = this.mediaConstraints, forceReload = false) {
        if (this.needForceReload) {
            forceReload = true;
            this.needForceReload = false;
        }

        if (!forceReload && (this.userMedia || this.userMedia$)) {
            if (this.userMedia) {
                return of(this.userMedia).pipe(take(1));
            } else {
                return this.userMedia$.pipe(take(1));
            }
        } else {
            this.userMedia$ = defer(async () => {
                try {
                    this.stopUserMedia(this.userMedia, false);

                    this.userMedia = await navigator.mediaDevices.getUserMedia(constraints);

                    // Mute all audio tracks on the dev environment
                    if (!environment.production) {
                        this.userMedia.getAudioTracks().forEach((item) => item.enabled = false);
                    }

                    this.hasBlockedStream = false;
                    return this.userMedia;
                } catch (err) {
                    this.handleGetUserMediaError(err);
                    if (['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(err.name)) {
                        try {
                            this.stopUserMedia(this.userMedia, false);

                            const fallbackStream = await navigator.mediaDevices.getUserMedia(this.fallbackMediaConstraints);
                            this.userMedia = fallbackStream;
                            this.hasBlockedStream = false;
                            return this.userMedia;
                        } catch (err) {
                            this.hasBlockedStream = true;
                            return this.stubbedStream;
                        }
                    } else {
                        this.hasBlockedStream = true;
                        return this.stubbedStream;
                    }
                }
            }).pipe(take(1));

            return this.userMedia$;
        }
    }

    public stopUserMedia(media = this.userMedia, markForceReload = true) {
        if (media) {
            media.getTracks().forEach((track) => track.stop());
        }
        this.needForceReload = markForceReload;
    }

    public getMediaConstraints() {
        return this.mediaConstraints;
    }

    public setTrackIds(videoTrackId: string, audioTrackId: string) {
        return forkJoin([
            this.setVideoTrackId(videoTrackId),
            this.setAudioTrackId(audioTrackId)
        ])
            .pipe(
                map(([player, _]) => player)
            );
    }

    public setVideoTrackId(trackId: string) {
        if (isUndefined(trackId)) {
            throw new Error('Track ID not specified');
        }

        const userId = this.userService.getCurrentUserId();
        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (isNil(userId) || isNil(selectedRoomId)) {
            throw new Error('User ID or Room ID not specified');
        }

        return this.firebaseService.update(
            PlayerDto,
            'players',
            `${selectedRoomId}_${userId}`,
            { videoId: trackId, isVideoMuted: !trackId }
        );
    }

    public setAudioTrackId(trackId: string) {
        if (isUndefined(trackId)) {
            throw new Error('Track ID not specified');
        }

        const userId = this.userService.getCurrentUserId();
        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (isNil(userId) || isNil(selectedRoomId)) {
            throw new Error('User ID or Room ID not specified');
        }

        return this.firebaseService.update(
            PlayerDto,
            'players',
            `${selectedRoomId}_${userId}`,
            { audioId: trackId, isAudioMuted: !trackId }
        );
    }

    public toggleMedia({ toggleVideo = false, toggleAudio = false }) {
        const userId = this.userService.getCurrentUserId();
        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (isNil(userId) || isNil(selectedRoomId)) {
            throw new Error('User ID or Room ID not specified');
        }

        const player = this.roomService.getRoomMember(userId, selectedRoomId);

        const updatedData: Partial<PlayerDto> = {};
        if (toggleVideo) {
            updatedData.isVideoMuted = !player.isVideoMuted;
        }
        if (toggleAudio) {
            updatedData.isAudioMuted = !player.isAudioMuted;
        }

        return this.firebaseService.update(
            PlayerDto,
            'players',
            `${selectedRoomId}_${userId}`,
            updatedData
        );
    }

    // Handle errors which occur when trying to access the local media
    // hardware; that is, exceptions thrown by getUserMedia(). The two most
    // likely scenarios are that the user has no camera and/or microphone
    // or that they declined to share their equipment when prompted. If
    // they simply opted not to share their media, that's not really an
    // error, so we won't present a message in that situation.
    private handleGetUserMediaError(e: Error) {
        switch (e.name) {
            case 'OverconstrainedError':
            case 'ConstraintNotSatisfiedError':
                console.error('No constraint support was found:' + e.message);
                break;
            case 'NotFoundError':
                console.error('No camera and/or microphone were found.');
                break;
            case 'SecurityError':
            case 'PermissionDeniedError':
                // Do nothing; this is the same as the user canceling the call.
                break;
            default:
                console.error('Error opening your camera and/or microphone: ' + e.message);
                break;
        }
    }

    private initConstraints() {
        const supports = navigator.mediaDevices.getSupportedConstraints();
        const videoConstraints = this.mediaConstraints.video as MediaTrackConstraints;
        const audioConstraints = this.mediaConstraints.audio as MediaTrackConstraints;

        if (!supports.width) {
            delete videoConstraints.width;
        }
        if (!supports.height) {
            delete videoConstraints.height;
        }
        if (!supports.frameRate) {
            delete videoConstraints.frameRate;
        }
        if (!supports.echoCancellation) {
            delete audioConstraints.echoCancellation;
        }
    }
}
