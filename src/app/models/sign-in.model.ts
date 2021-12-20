export class SignIn {
    public email: string = null;
    public password: string = null;

    constructor(data?: Partial<SignIn>) {
        Object.assign(this, data);
    }
}
