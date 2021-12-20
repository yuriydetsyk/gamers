import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

import { GameComponent } from '../../modules/games/components/game/game.component';
import { GameService } from '../services/game.service';
import { PeerService } from '../services/peer.service';

@Injectable({
    providedIn: 'root'
})
export class PeerGuard implements CanDeactivate<GameComponent> {
    constructor(
        private readonly gameService: GameService,
        private readonly peerService: PeerService
    ) { }

    public canDeactivate() {
        const game = this.gameService.getSelectedGame();
        if (!game) {
            return of(true);
        }

        return this.peerService.destroyPeer(game).pipe(map(() => true));
    }
}
