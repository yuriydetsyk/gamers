export class Card {
    public id: string = null;
    public hidden: boolean = null;
    public shared: boolean = null;
    public sharedWithPlayerId: number = null;
    public requester: number = null;
    public panicRequester: number = null;
    public eventRequester: number = null;
    public blockFrom: number = null;
    public stepsSpent: number = null;

    constructor(data?: Partial<Card>) {
        Object.assign(this, data);
    }
}
