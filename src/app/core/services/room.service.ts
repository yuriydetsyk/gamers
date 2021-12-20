import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, Subject, Subscription } from 'rxjs';
import { finalize, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';

import { GameRoomDto } from '../../models/dtos/game-room-dto.model';
import { PlayerDto } from '../../models/dtos/player-dto.model';
import { Game } from '../../models/enums/game.enum';
import { Role } from '../../models/enums/role.enum';
import { UserAction } from '../../models/enums/user-action';
import { isNil } from '../helpers/type.helpers';
import { FirebaseService } from './firebase.service';
import { RatingService } from './rating.service';
import { TokenService } from './token.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { TranslateService } from '@ngx-translate/core';
import { NotificationLocation } from '../../models/enums/notification-location.enum';
import { AudioHelpers } from '../helpers/audio.helpers';
import { SoundEffect } from '../../models/enums/sound-effect.enum';

@Injectable({
    providedIn: 'root'
})
export class RoomService implements OnDestroy {
    public rooms$ = new BehaviorSubject<GameRoomDto[]>([]);
    public selectedRooms$ = new BehaviorSubject<GameRoomDto[]>([]);
    public roomMembers$ = new BehaviorSubject<PlayerDto[]>([]);
    public roomMembers: PlayerDto[] = [];
    public get selectedRooms() {
        return this.selectedRooms$.value;
    }
    public get isPlaying() {
        const selectedRoomId = this.getSelectedRoomId(this.selectedGame);
        if (isNil(selectedRoomId)) {
            return false;
        }

        return !isNil(
            this.roomMembers.find((item) => item.userId === this.userId && item.roomId === selectedRoomId && !isNil(item.playerId))
        );
    }
    public roomsResolved = false;

    private pendingResolvedRooms: Observable<GameRoomDto[]>;
    private subscription = new Subscription();
    private userId: string;
    private selectedGame: Game;
    private destroy$ = new Subject<void>();
    private get rooms() {
        return this.rooms$.value;
    }

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly ratingService: RatingService,
        private readonly notificationService: NotificationService,
        private readonly translateService: TranslateService,
        private readonly audioHelpers: AudioHelpers
    ) {
        this.subscription.add(
            this.tokenService.isLogged$
                .pipe(
                    tap((isLogged) => {
                        if (isLogged) {
                            this.userId = this.userService.getCurrentUserId();
                        }
                    })
                )
                .subscribe()
        );

        this.firebaseService.listen(GameRoomDto, 'rooms')
            .pipe(takeUntil(this.destroy$))
            .subscribe((rooms) => this.rooms$.next(rooms));

        this.firebaseService.listen(PlayerDto, 'players')
            .pipe(
                tap((players) => { // process audio sound
                    const selectedRoomId = this.getSelectedRoomId();
                    if (selectedRoomId) {
                        const oldUserIds = this.roomMembers
                            .filter((item) => {
                                return item.roomId === selectedRoomId && item.userId !== this.userId;
                            })
                            .map((item) => item.userId);

                        const newUserIds = players
                            .filter((item) => {
                                return item.roomId === selectedRoomId && item.userId !== this.userId;
                            })
                            .map((item) => item.userId);

                        const someUsersQuit = oldUserIds.some((item) => !newUserIds.includes(item));
                        const someUsersJoined = newUserIds.some((item) => !oldUserIds.includes(item));
                        if (someUsersQuit) {
                            this.audioHelpers.playSound(SoundEffect.LeaveRoom);
                        }
                        if (someUsersJoined) {
                            this.audioHelpers.playSound(SoundEffect.JoinRoom);
                        }
                    }
                }),
                tap((players) => {
                    this.roomMembers = players;
                    this.roomMembers$.next(this.roomMembers);
                }),
                map((players) => players.filter((player) => player.userId === this.userId)),
                switchMap((players) => {
                    const roomIds = players.map((player) => player.roomId);

                    return this.rooms$
                        .pipe(
                            map((rooms) => rooms.filter((room) => roomIds.includes(room.id)))
                        );
                }),
                map((selectedRooms) => {
                    const selectedRoomId = this.getSelectedRoomId();
                    if (selectedRoomId) {
                        const oldSelectedRoom = this.selectedRooms.find((room) => room.id === selectedRoomId);
                        const newSelectedRoom = selectedRooms.find((room) => room.id === selectedRoomId);

                        if (oldSelectedRoom && newSelectedRoom) {
                            if (!oldSelectedRoom.isGameMode && newSelectedRoom.isGameMode) {
                                this.audioHelpers.playSound(SoundEffect.GameStart);
                            }
                            if (!oldSelectedRoom.isGameFinished && newSelectedRoom.isGameFinished) {
                                this.audioHelpers.playSound(SoundEffect.GameEnd);
                            }
                        }
                    }

                    this.selectedRooms$.next(selectedRooms);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public selectRoom(roomId: string, game = this.selectedGame) {
        if (isNil(roomId) || isNil(game)) {
            return;
        }

        const selectedRoom = this.rooms.find((room) => room.id === roomId);
        if (!selectedRoom) {
            throw new Error('Room not specified');
        }

        return this.firebaseService.set(
            PlayerDto,
            'players',
            `${roomId}_${this.userId}`,
            {
                roomId,
                userId: this.userId
            }
        );
    }

    public leaveRoom(game = this.selectedGame) {
        if (isNil(game)) {
            throw new Error('Game not specified');
        }

        const selectedRoomId = this.getSelectedRoomId(game);
        if (isNil(selectedRoomId)) {
            throw new Error('Room ID not specified');
        }

        return this.firebaseService.delete(
            PlayerDto,
            'players',
            `${selectedRoomId}_${this.userId}`
        );
    }

    public getSelectedRoom(game = this.selectedGame) {
        if (isNil(game)) {
            return null;
        }

        return this.selectedRooms.find((room) => room.game === game) || null;
    }

    public getSelectedRoomId(game = this.selectedGame) {
        if (isNil(game)) {
            return null;
        }

        const selectedRoom = this.getSelectedRoom(game);
        return selectedRoom ? selectedRoom.id : null;
    }

    public getRoom(roomId: string) {
        if (isNil(roomId)) {
            return null;
        }

        return this.rooms.find((item) => item.id === roomId);
    }

    public getRooms(game = this.selectedGame) {
        if (isNil(game)) {
            return [];
        }

        return this.rooms;
    }

    public addRoom(room: GameRoomDto) {
        if (isNil(room)) {
            throw new Error('Room not specified');
        }

        room.id = this.firebaseService.generateId(7);
        room.authorId = this.userId;
        room.ownerId = this.userId;
        room.botManagerId = this.userId;

        return forkJoin([
            this.firebaseService.set(GameRoomDto, 'rooms', room.id, room),
            this.ratingService.addXp(this.userId, UserAction.CreateRoom)
        ]);
    }

    public deleteRoom(roomId: string) {
        if (isNil(roomId)) {
            throw new Error('Room ID not specified');
        }

        return this.firebaseService.delete(GameRoomDto, 'rooms', roomId).pipe(
            tap(() => this.notificationService.addNotification({
                level: 'info',
                message: this.translateService.instant(
                    'i18n.NOTIFICATIONS.ROOM_DELETED',
                    { roomId }
                ),
                location: NotificationLocation.Aside
            }))
        );
    }

    public selectGame(game: Game) {
        this.selectedGame = game;
    }

    public setGameMode(roomId: string, isGameMode: boolean) {
        if (isNil(roomId)) {
            throw new Error('Room ID not specified');
        }

        return this.firebaseService.update(GameRoomDto, 'rooms', roomId, { isGameMode });
    }

    public setGameFinished(roomId: string, isGameFinished: boolean) {
        if (isNil(roomId)) {
            throw new Error('Room ID not specified');
        }

        return this.firebaseService.update(GameRoomDto, 'rooms', roomId, { isGameFinished });
    }

    public isGameMode(roomId = this.getSelectedRoomId()) {
        if (!roomId) {
            return false;
        }

        const room = this.getRoom(roomId);
        return room ? room.isGameMode : false;
    }

    public isGameFinished(roomId = this.getSelectedRoomId()) {
        if (!roomId) {
            return false;
        }

        const room = this.getRoom(roomId);
        return room ? room.isGameFinished : false;
    }

    public getRoomMembers(roomId: string) {
        return this.roomMembers.filter((item) => item.roomId === roomId);
    }

    public getRoomMember(userId: string, roomId: string) {
        return this.roomMembers.find((player) => player.userId === userId && player.roomId === roomId) || null;
    }

    public getRoomMemberByPlayerId(playerId: number, roomId: string) {
        return this.roomMembers.find((player) => player.playerId === playerId && player.roomId === roomId) || null;
    }

    public getSelectedRoomMembers() {
        return this.roomMembers.filter((item) => item.roomId === this.getSelectedRoomId());
    }

    public fetchRooms() {
        return this.firebaseService.getAll(GameRoomDto, 'rooms');
    }

    public fetchSelectedRooms() {
        return this.firebaseService.getAll(PlayerDto, 'players')
            .pipe(
                tap((players) => this.roomMembers = players),
                map((players) => players.filter((player) => player.userId === this.userId)),
                switchMap((players) => {
                    const roomIds = players.map((player) => player.roomId);
                    return this.rooms$
                        .pipe(
                            map((rooms) => rooms.filter((room) => roomIds.includes(room.id)))
                        );
                })
            );
    }

    public anybodyWon(roomId = this.getSelectedRoomId()) {
        if (isNil(roomId)) {
            return false;
        }

        return this.humansWon(roomId) || this.itWon(roomId);
    }

    public humansWon(roomId = this.getSelectedRoomId()) {
        if (isNil(roomId)) {
            return false;
        }

        return !this.roomMembers.some((item) => item.roomId === roomId && item.role === Role.It);
    }

    public itWon(roomId = this.getSelectedRoomId()) {
        if (isNil(roomId)) {
            return false;
        }

        return !this.roomMembers.some((item) => item.roomId === roomId && item.role === Role.Human);
    }

    public isRoomOwner(userId: string, roomId = this.getSelectedRoomId()) {
        if (!userId) {
            return false;
        }

        const room = this.rooms.find((item) => item.id === roomId);
        return room ? (room.ownerId === userId || room.authorId === userId) : false;
    }

    public isBotManager(userId: string, roomId = this.getSelectedRoomId()) {
        const room = this.rooms.find((item) => item.id === roomId);
        return room ? room.botManagerId === userId : false;
    }

    public getBotManagerId(roomId = this.getSelectedRoomId()) {
        const room = this.rooms.find((item) => item.id === roomId);
        return room ? room.botManagerId : null;
    }

    // TODO: refactor
    public resolveRooms() {
        if (!this.pendingResolvedRooms) {
            this.pendingResolvedRooms = this.fetchRooms()
                .pipe(
                    tap((rooms) => this.rooms$.next(rooms)),
                    switchMap(() => this.fetchSelectedRooms()),
                    tap((selectedRooms) => {
                        this.selectedRooms$.next(selectedRooms);
                        this.roomMembers$.next(this.roomMembers);
                    }),
                    map(() => this.rooms),
                    take(1),
                    finalize(() => this.roomsResolved = true)
                );
        }

        return this.pendingResolvedRooms;
    }

    public hasRoomOwner(roomId: string) {
        return !!this.getRoom(roomId).ownerId;
    }

    public setRoomOwner(roomId: string, userId?: string) {
        const currentRoomOwner = this.getRoom(roomId).ownerId;
        if (!userId) {
            const newRoomOwner = this.getRoomMembers(roomId)
                .filter((item) => item.userId !== currentRoomOwner)
                .shift();

            userId = newRoomOwner ? newRoomOwner.userId : null;
        }

        return this.firebaseService.update(GameRoomDto, 'rooms', roomId, { ownerId: userId });
    }
}
