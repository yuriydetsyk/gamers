import { OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';

import { isNil } from '../../../../core/helpers/type.helpers';
import { BotService } from '../../../../core/services/bot.service';
import { GameService } from '../../../../core/services/game.service';
import { RoomService } from '../../../../core/services/room.service';
import { Game } from '../../../../models/enums/game.enum';
import { UserService } from '../../../../core/services/user.service';

export class GameComponent implements OnInit, OnDestroy {
    public userMedia: MediaStream;
    public selectedGame: Game;
    public get hasSelectedRoom() {
        return this.selectedGame && !isNil(this.roomService.getSelectedRoomId(this.selectedGame));
    }
    protected subscription = new Subscription();
    protected destroy$ = new Subject<void>();

    constructor(
        protected readonly activatedRoute: ActivatedRoute,
        protected readonly gameService: GameService,
        protected readonly roomService: RoomService,
        protected readonly botService: BotService,
        protected readonly router: Router,
        protected readonly userService: UserService
    ) { }

    public ngOnInit() {
        if (this.selectedGame) {
            this.gameService.selectGame(this.selectedGame);
        }

        this.botService.processBotManagement().subscribe();

        const selectedRoomId = this.roomService.getSelectedRoomId();
        if (!this.roomService.hasRoomOwner(selectedRoomId)) {
            this.roomService.setRoomOwner(selectedRoomId, this.userService.getCurrentUserId());
        }
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();

        this.destroy$.next();
        this.destroy$.complete();
    }
}
