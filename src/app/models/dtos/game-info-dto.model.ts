import { Game } from '../enums/game.enum';

export class GameInfoDto {
    public bannerClass: string = null;
    public game: Game = null;
    public description: string = null;
    public manualUrl: string = null;

    constructor(data?: Partial<GameInfoDto>) {
        Object.assign(this, data);
    }
}
