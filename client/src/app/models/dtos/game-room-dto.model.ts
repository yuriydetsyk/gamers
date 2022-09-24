import { Game } from '../enums/game.enum';

export class GameRoomDto {
    public id: string = null;
    public name: string = null;
    public description: string = null;
    public game: Game = null;
    public authorId: string = null;
    public ownerId: string = null;
    public botManagerId: string = null;
    public isGameMode = false;
    public isGameFinished = false;
    public hasRandomStartingPlayer = false;
    public hasCardsBasedOnQuantity = false;
    public maxQuantity: number = null;

    constructor(data?: Partial<GameRoomDto>) {
        Object.assign(this, data);
    }
}
