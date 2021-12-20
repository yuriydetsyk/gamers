import { Gender } from './enums/gender.enum';
import { SignIn } from './sign-in.model';

export class SignUp extends SignIn {
    public gender: Gender = null;
    public biography: string = null;

    constructor(data?: Partial<SignUp>) {
        super(data);
        Object.assign(this, data);
    }

    public mapToSignInModel() {
        return new SignIn({
            email: this.email,
            password: this.password
        });
    }
}
