export class PeerStream {
    public peerId: string;
    public stream: MediaStream;

    constructor(data?: Partial<PeerStream>) {
        Object.assign(this, data);
    }
}
