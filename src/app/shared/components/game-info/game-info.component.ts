import { Component, Input } from '@angular/core';

import { getMultilineText } from '../../../core/helpers/string.helpers';
import { GameInfoService } from '../../../core/services/game-info.service';
import { GameInfoDto } from '../../../models/dtos/game-info-dto.model';
import { Game } from '../../../models/enums/game.enum';

@Component({
    selector: 'gw-game-info',
    templateUrl: './game-info.component.html',
    styleUrls: ['./game-info.component.scss']
})
export class GameInfoComponent {
    @Input()
    public game: Game;
    public get info(): GameInfoDto {
        return this.game ? this.gameInfoService.getGameInfo(this.game) : null;
    }
    public Game = Game;

    constructor(private readonly gameInfoService: GameInfoService) { }

    public getMultilineText(text: string) {
        return getMultilineText(text);
    }
}
