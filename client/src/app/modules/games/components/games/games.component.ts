import { Component } from '@angular/core';

import { Game } from '../../../../models/enums/game.enum';

@Component({
    selector: 'gw-games',
    templateUrl: './games.component.html',
    styleUrls: ['./games.component.scss']
})
export class GamesComponent {
    public Game = Game;
}
