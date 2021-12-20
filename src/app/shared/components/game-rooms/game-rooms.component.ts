import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { RoomService } from '../../../core/services/room.service';
import { UserService } from '../../../core/services/user.service';
import { GameRoomDto } from '../../../models/dtos/game-room-dto.model';
import { PlayerDto } from '../../../models/dtos/player-dto.model';
import { Game } from '../../../models/enums/game.enum';
import { GameService } from '../../../core/services/game.service';
import { BotService } from '../../../core/services/bot.service';

@Component({
    selector: 'gw-game-rooms',
    templateUrl: './game-rooms.component.html',
    styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsComponent implements OnInit, OnDestroy {
    @Input()
    public game: Game;
    public rooms: GameRoomDto[];
    public roomMembers: PlayerDto[];
    public form: FormGroup;
    private subscription = new Subscription();

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly userService: UserService,
        private readonly roomService: RoomService,
        private readonly router: Router,
        private readonly activatedRoute: ActivatedRoute,
        private readonly gameService: GameService,
        private readonly botService: BotService
    ) { }

    public ngOnInit() {
        this.createForm();

        this.subscription.add(
            this.roomService.rooms$.subscribe((rooms) => this.rooms = rooms)
        );

        this.subscription.add(
            this.roomService.roomMembers$.subscribe((roomMembers) => this.roomMembers = roomMembers)
        );
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public joinRoom(roomId: string) {
        this.router.navigate(['../', roomId], { relativeTo: this.activatedRoute });
    }

    public addRoom() {
        if (this.form.valid) {
            const rawValue = this.form.getRawValue();

            this.roomService.addRoom(rawValue)
                .subscribe(() => {
                    const maxAllowedPlayers = this.gameService.getMaxAllowedPlayers(this.game);
                    this.form.reset({ game: rawValue.game, maxQuantity: maxAllowedPlayers });
                });
        }
    }

    public deleteRoom(roomId: string) {
        forkJoin([
            this.roomService.deleteRoom(roomId),
            this.botService.removeBots(roomId)
        ]).subscribe();
    }

    public isRoomOwner(roomId: string) {
        return this.roomService.isRoomOwner(this.userService.getCurrentUserId(), roomId);
    }

    public getPlayersQty(roomId: string) {
        if (!this.roomMembers) {
            return 0;
        } else {
            return this.roomMembers.filter((item) => item.roomId === roomId).length;
        }
    }

    public isGameFinished(roomId: string) {
        return this.roomService.isGameFinished(roomId);
    }

    public getMaxPlayersQty(room?: GameRoomDto) {
        return (room && room.maxQuantity) || this.gameService.getMaxAllowedPlayers(this.game);
    }

    public getMinPlayersQty() {
        return this.gameService.getMinAllowedPlayers(this.game);
    }

    private createForm() {
        const maxAllowedPlayers = this.gameService.getMaxAllowedPlayers(this.game);

        this.form = this.formBuilder.group({
            name: [null, [Validators.required]],
            description: null,
            game: [this.game, [Validators.required]],
            hasRandomStartingPlayer: false,
            hasCardsBasedOnQuantity: false,
            maxQuantity: [
                maxAllowedPlayers,
                [Validators.min(4), Validators.max(maxAllowedPlayers)]
            ]
        });
    }
}
