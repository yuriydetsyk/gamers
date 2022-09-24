import { Component, HostBinding, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';

import { isNil } from '../../../../../../core/helpers/type.helpers';
import { CardService } from '../../../../../../core/services/card.service';
import { GameService } from '../../../../../../core/services/game.service';
import { RoomService } from '../../../../../../core/services/room.service';
import { CardLocation } from '../../../../../../models/enums/card-location.enum';
import { NechtoCard } from '../../../../../../models/nechto-card.model';
import { NechtoCardComponent } from '../nechto-card/nechto-card.component';

@Component({
    selector: 'gw-nechto-table',
    templateUrl: './nechto-table.component.html',
    styleUrls: ['./nechto-table.component.scss']
})
export class NechtoTableComponent implements OnDestroy {
    @HostBinding('class')
    public class = 'smth-table-wrapper';

    public NechtoCard = NechtoCard;
    public get game() {
        return this.gameService.currentGame;
    }
    public CardLocation = CardLocation;
    @ViewChildren(NechtoCardComponent)
    public cardComponents: QueryList<NechtoCardComponent>;
    public get isGameMode() {
        return this.roomService.isGameMode() && !isNil(this.game);
    }
    public get isGameFinished() {
        return this.roomService.isGameFinished();
    }
    public get humansWon() {
        return this.roomService.humansWon();
    }
    public get isBotPlaying() {
        return this.gameService.isBotPlaying;
    }
    public get isTakingStep() {
        return this.gameService.isTakingStep(this.gameService.getActivePlayerId());
    }
    public get canStartGame() {
        if (!this.roomService.getSelectedRoomId()) {
            return false;
        }

        return !this.isGameMode && this.gameService.hasEnoughPlayers;
    }
    private subscription = new Subscription();

    constructor(
        private readonly gameService: GameService,
        private readonly roomService: RoomService,
        private readonly cardService: CardService
    ) { }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public startGame() {
        if (this.canStartGame) {
            this.gameService.startGame().subscribe();
        }
    }

    public endGame() {
        if (this.isGameMode) {
            this.gameService.endGame(this.roomService.getSelectedRoomId()).subscribe();
        }
    }

    public refillDeck() {
        if (!this.isTakingStep) {
            return;
        }

        this.cardService.refillDeck().subscribe();
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
        if (row === 2) {
            return 'justify-content-between';
        }

        if (this.isGameMode) {
            return 'justify-content-center';
        } else {
            return 'justify-content-around';
        }
    }
}
