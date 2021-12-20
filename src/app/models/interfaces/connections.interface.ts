import { MediaConnection } from 'peerjs';
import { Game } from '../enums/game.enum';

export interface Connections {
    game: Game;
    newCalls: MediaConnection[];
}
