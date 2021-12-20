export class Player {
    public id: number = null;
    public audioLevel: number = null;
    public stream: MediaStream = null;

    constructor(data?: Partial<Player>) {
        Object.assign(this, data);
    }
}
