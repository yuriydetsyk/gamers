import { UserLevel } from '../enums/user-level.enum';

export class RatingInfoDto {
    public level: UserLevel;
    public minXp: number;
    public maxXp: number;

    constructor(data?: Partial<RatingInfoDto>) {
        Object.assign(this, data);
    }
}
