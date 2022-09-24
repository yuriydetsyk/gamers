import { UserLevel } from '../enums/user-level.enum';
import { UserDto } from '../dtos/user-dto.model';
import { UserRatingDto } from '../dtos/user-rating-dto.model';

export class RatingView {
    public user: UserDto;
    public gamesPlayed: number;
    public wins: number;
    public losses: number;
    public level: UserLevel;
    public xp: number;

    constructor(data?: Partial<RatingView>) {
        Object.assign(this, data);
    }

    public static mapFromDto(rating: UserRatingDto, user: UserDto) {
        if (!rating || !user) {
            return null;
        }

        const { userId, ...ratingData } = rating;
        return new RatingView({ ...ratingData, user });
    }

    public static mapFromDtoBulk(ratings: UserRatingDto[], users: UserDto[]) {
        if (!ratings || !users) {
            return [];
        }

        return ratings
            .map((rating) => {
                const user = users.find((item) => item.id === rating.userId);
                return this.mapFromDto(rating, user);
            })
            .filter((rating) => !!rating);
    }
}
