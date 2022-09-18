import { Gender } from '../enums/gender.enum';

export class UserDto {
    public id: string = null;
    public username: string = null;
    public firstName: string = null;
    public lastName: string = null;
    public gender: Gender = null;
    public biography: string = null;
    public isBot = false;
    public hasFilledData = false;
    public avatar: string = null;

    constructor(data?: Partial<UserDto>) {
        Object.assign(this, data);
    }

    public getAvatarUrl() {
        if (this) {
            if (!!this.avatar) {
                return this.avatar;
            } else if (this.gender === Gender.Female) {
                return '/assets/images/avatar-female.png';
            } else {
                return '/assets/images/avatar-male.png';
            }
        } else {
            return '/assets/images/avatar.jpg';
        }
    }

    public hasAllData() {
        return this
            && !!this.avatar
            && !!this.biography
            && !!this.firstName
            && !!this.lastName
            && !!this.gender
            && !!this.username;
    }
}
