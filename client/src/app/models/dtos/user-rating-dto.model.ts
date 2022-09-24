import { UserLevel } from '../enums/user-level.enum';

export class UserRatingDto {
    public userId: string = null;
    public gamesPlayed = 0;
    public wins = 0;
    public losses = 0;
    public level: UserLevel = UserLevel.Noob;
    public xp = 0;

    constructor(data?: Partial<UserRatingDto>) {
        Object.assign(this, data);
    }
}
