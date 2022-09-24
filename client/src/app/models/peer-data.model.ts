import Peer, { MediaConnection } from 'peerjs';

import { Game } from './enums/game.enum';
import { PeerStream } from './peer-stream.model';

export class PeerData {
    public game: Game;
    public currentPeer: Peer;
    public activeStreams: PeerStream[] = [];
    public activeCalls: MediaConnection[] = [];

    constructor(data?: Partial<PeerData>) {
        Object.assign(this, data);
    }
}
