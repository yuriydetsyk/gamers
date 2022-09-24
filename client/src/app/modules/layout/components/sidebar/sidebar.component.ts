import { Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { flatten } from '../../../../core/helpers/array.helpers';
import { BotService } from '../../../../core/services/bot.service';
import { CardService } from '../../../../core/services/card.service';
import { GameService } from '../../../../core/services/game.service';
import { RoomService } from '../../../../core/services/room.service';
import { UserService } from '../../../../core/services/user.service';
import { LockedDoorOption } from '../../../../models/interfaces/locked-door-option.interface';

@Component({
    selector: 'gw-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnDestroy {
    public isOpened = false;
    public connectionSettingsForm: FormGroup;
    public audioTracks: MediaStreamTrack[] = [];
    public videoTracks: MediaStreamTrack[] = [];
    public get canLeaveRoom() {
        return this.gameService.canLeaveRoom;
    }
    public get selectedRoom() {
        return this.roomService.getSelectedRoom();
    }
    public get isGameMode() {
        return this.roomService.isGameMode();
    }
    public get isGameFinished() {
        return this.roomService.isGameFinished();
    }
    public get isInactive() {
        return this.gameService.isInactive();
    }
    public get activePlayerId() {
        return this.gameService.getActivePlayerId();
    }
    public get availableAddPlaces() {
        if (!this.selectedRoom) {
            return [];
        }

        return this.gameService.getInactivePlayerComponents().map((item) => item.playerId);
    }
    public get availableRemovePlaces() {
        if (!this.selectedRoom) {
            return [];
        }

        return this.gameService.getActiveBotComponents().map((item) => item.playerId);
    }
    public get isBotManager() {
        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (!selectedRoomId) {
            return false;
        }

        return this.roomService.isBotManager(this.userService.getCurrentUserId(), selectedRoomId);
    }
    public get roomCreator() {
        const selectedRoom = this.roomService.getSelectedRoom();
        if (!selectedRoom) {
            return null;
        }

        const user = this.userService.getUser(selectedRoom.authorId);
        return user ? user.username : null;
    }
    public get roomOwner() {
        const selectedRoom = this.roomService.getSelectedRoom();
        if (!selectedRoom) {
            return null;
        }

        const user = this.userService.getUser(selectedRoom.ownerId);
        return user ? user.username : null;
    }
    public get isRoomOwner() {
        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (!selectedRoomId) {
            return false;
        }

        return this.roomService.isRoomOwner(this.userService.getCurrentUserId(), selectedRoomId);
    }
    public get quarantineOptions() {
        return this.gameService.getActivePlayerComponents()
            .filter((item) => !this.gameService.hasQuarantine(item.playerId))
            .map((item) => item.playerId);
    }
    // TODO: add return type
    public get lockedDoorOptions() {
        return flatten(
            this.gameService.getActivePlayerComponents()
                .filter((item) => this.gameService.getLockedDoors(item.playerId).length < 2)
                .map((item) => {
                    const options: LockedDoorOption[] = [];
                    const previousPlayerId = this.gameService.getPreviousPlayer(item.playerId).playerId;
                    const nextPlayerId = this.gameService.getNextPlayer(item.playerId).playerId;

                    if (!this.gameService.hasLockedDoor(item.playerId, previousPlayerId)
                        && !this.gameService.hasLockedDoor(previousPlayerId, item.playerId)) {
                        options.push({ fromId: item.playerId, toId: previousPlayerId });
                    }
                    if (!this.gameService.hasLockedDoor(item.playerId, nextPlayerId)
                        && !this.gameService.hasLockedDoor(nextPlayerId, item.playerId)) {
                        options.push({ fromId: item.playerId, toId: nextPlayerId });
                    }

                    return options;
                })
        );
    }
    public get canStartGame() {
        if (!this.roomService.getSelectedRoomId()) {
            return false;
        }

        return !this.isGameMode && this.gameService.hasEnoughPlayers;
    }

    private destroy$ = new Subject<void>();

    constructor(
        private readonly gameService: GameService,
        private readonly roomService: RoomService,
        private readonly router: Router,
        private readonly botService: BotService,
        private readonly userService: UserService,
        private readonly cardService: CardService
    ) { }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public toggleSidebar() {
        this.isOpened = !this.isOpened;
    }

    public leaveRoom() {
        this.roomService.leaveRoom().subscribe(() => this.navigateToLobby());
    }

    public endGame() {
        if (!this.isGameMode) {
            return;
        }

        const selectedRoomId = this.roomService.getSelectedRoomId();
        this.gameService.endGame()
            .pipe(
                switchMap(() => this.botService.processBotManagement(selectedRoomId, true))
            )
            .subscribe(() => this.navigateToLobby());
    }

    public restartGame() {
        if (!this.isGameMode) {
            return;
        }

        this.gameService.restartGame().subscribe();
    }

    public stopGame() {
        if (!this.isGameMode) {
            return;
        }

        const selectedRoomId = this.roomService.getSelectedRoomId();
        this.gameService.endGame(selectedRoomId, false).subscribe();
    }

    public startGame() {
        if (!this.canStartGame) {
            return;
        }

        this.gameService.startGame().subscribe();
    }

    public addBot(place: number) {
        this.botService.addBot(this.selectedRoom.id, place).subscribe();
    }

    public removeBot(place: number) {
        this.botService.removeBot(this.selectedRoom.id, place).subscribe();
    }

    public putOnQuarantine(playerId: number) {
        this.cardService.putOnQuarantine(playerId).subscribe();
    }

    public setLockedDoor(option: LockedDoorOption) {
        this.cardService.setLockedDoor(option).subscribe();
    }

    public trackLockedDoorOptions(_: number, item: LockedDoorOption) {
        return item.fromId && item.toId;
    }

    private navigateToLobby() {
        const selectedGame = this.gameService.getSelectedGame();
        if (selectedGame) {
            this.router.navigate(['/games', selectedGame.toLowerCase(), 'lobby']);
        } else {
            this.router.navigate(['/games']);
        }
    }
}
