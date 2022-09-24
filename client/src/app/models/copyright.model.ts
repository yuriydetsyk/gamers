export class Copyright {
    public authorName: string = null;
    public authorCompanyName: string = null;
    public authorCompanyUrl: string = null;

    constructor(data?: Partial<Copyright>) {
        Object.assign(this, data);
    }
}
