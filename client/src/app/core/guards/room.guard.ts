import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanDeactivate, Router, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Game } from '../../models/enums/game.enum';
import { GameComponent } from '../../modules/games/components/game/game.component';
import { BotService } from '../services/bot.service';
import { RoomService } from '../services/room.service';

@Injectable({
    providedIn: 'root'
})
export class RoomGuard implements CanActivate, CanDeactivate<GameComponent> {
    constructor(
        private readonly roomService: RoomService,
        private readonly router: Router,
        private readonly botService: BotService
    ) { }

    public canActivate(next: ActivatedRouteSnapshot) {
        if (!this.roomService.roomsResolved) {
            return this.roomService.resolveRooms().pipe(switchMap(() => this.canActivateRoom(next)));
        } else {
            return this.canActivateRoom(next);
        }
    }

    public canDeactivate(_: GameComponent, route: ActivatedRouteSnapshot) {
        const selectedRoomId = route.paramMap.get('roomId');
        if (!selectedRoomId) {
            return of(true);
        }

        return this.botService.processBotManagement(selectedRoomId, true, false).pipe(map(() => true)).pipe(
            switchMap(() => this.roomService.setRoomOwner(selectedRoomId)),
            map(() => true)
        );
    }

    private canActivateRoom(next: ActivatedRouteSnapshot) {
        const selectedGame: Game = next.data.game;

        const requestedRoomId = next.paramMap.get('roomId');
        const selectedRoomId = this.roomService.getSelectedRoomId(selectedGame);
        if (selectedRoomId) {
            if (requestedRoomId === selectedRoomId) {
                return of(true);
            } else {
                this.router.navigate(['/games', selectedGame.toLowerCase(), selectedRoomId]);
                return of(false);
            }
        } else {
            if (!requestedRoomId) {
                return of(true);
            } else {
                try {
                    return this.roomService.selectRoom(requestedRoomId, selectedGame).pipe(map(() => true));
                } catch {
                    this.router.navigate(['/games', selectedGame.toLowerCase(), 'lobby']);
                    return of(false);
                }
            }
        }
    }
}
