import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Game } from '../../../models/enums/game.enum';

@Component({
    selector: 'gw-game-lobby',
    templateUrl: './game-lobby.component.html',
    styleUrls: ['./game-lobby.component.scss']
})
export class GameLobbyComponent implements OnInit {
    public selectedGame: Game;

    constructor(private readonly activatedRoute: ActivatedRoute) { }

    public ngOnInit() {
        this.activatedRoute.data.subscribe((data: { game: Game }) => {
            this.selectedGame = data.game;
        });
    }

}
