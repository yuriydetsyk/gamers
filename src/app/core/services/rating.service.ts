import { Injectable, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, EMPTY, Subject, throwError } from 'rxjs';
import { catchError, map, takeUntil, tap } from 'rxjs/operators';

import { RatingInfoDto } from '../../models/dtos/rating-info-dto.model';
import { UserRatingDto } from '../../models/dtos/user-rating-dto.model';
import { UserAction } from '../../models/enums/user-action';
import { UserLevel } from '../../models/enums/user-level.enum';
import { isNil } from '../helpers/type.helpers';
import { FirebaseService } from './firebase.service';
import { GameInfoService } from './game-info.service';
import { NotificationService } from './notification.service';
import { NotificationLocation } from '../../models/enums/notification-location.enum';

@Injectable({
    providedIn: 'root'
})
export class RatingService implements OnDestroy {
    public rating$ = new BehaviorSubject<UserRatingDto[]>([]);
    public ratingInfo$ = new BehaviorSubject<RatingInfoDto[]>([]);
    public get rating() {
        return this.rating$.getValue();
    }
    public get ratingInfo() {
        return this.ratingInfo$.getValue();
    }

    private rewardPoints = new Map<UserAction, number>([
        [UserAction.SignUp, 0],
        [UserAction.SignIn, 0],
        [UserAction.FillUserInfo, 100],
        [UserAction.CreateRoom, 100],
        [UserAction.WinGame, 500],
        [UserAction.LooseGame, 250]
    ]);
    private destroy$ = new Subject<void>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly notificationService: NotificationService,
        private readonly translateService: TranslateService,
        private readonly gameInfoService: GameInfoService
    ) {
        this.firebaseService.listen(UserRatingDto, 'rating')
            .pipe(takeUntil(this.destroy$))
            .subscribe((rating) => this.rating$.next(rating));

        this.firebaseService.listen(RatingInfoDto, 'rating-info')
            .pipe(takeUntil(this.destroy$))
            .subscribe((ratingInfo) => this.ratingInfo$.next(ratingInfo));
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public getLevel(userId: string): UserLevel {
        const rating = this.rating.find((item) => item.userId === userId);
        return rating ? rating.level : UserLevel.Noob;
    }

    public addXp(userId: string, action: UserAction, notify = true) {
        if (!userId) {
            console.warn('Missing user ID');
            return EMPTY;
        }

        if (isNil(action)) {
            console.warn('Missing action');
            return EMPTY;
        }

        const levels = this.ratingInfo$.getValue();

        if (!this.rating || !levels) {
            console.warn('Missing rating data or levels info');
            return EMPTY;
        }

        const userRating = this.rating.find((item) => item.userId === userId);
        const gainedXp = this.getRewardPoints(action);
        let newXp: number;
        let newLevel: UserLevel;

        if (userRating) {
            // tslint:disable-next-line: prefer-const
            let { gamesPlayed, wins, losses } = userRating;
            if (action === UserAction.LooseGame) {
                gamesPlayed += 1;
                losses += 1;
            } else if (action === UserAction.WinGame) {
                gamesPlayed += 1;
                wins += 1;
            }

            newXp = userRating.xp + gainedXp;
            newLevel = levels.find((item) => item.minXp <= newXp && (!item.maxXp || item.maxXp > newXp)).level;

            if (notify) {
                this.sendXpNotification(gainedXp, action);
            }

            return this.firebaseService.update(
                UserRatingDto,
                'rating',
                userId,
                {
                    gamesPlayed,
                    wins,
                    losses,
                    xp: newXp,
                    level: newLevel
                }
            ).pipe(catchError((err) => throwError(err)));
        } else {
            newXp = gainedXp;
            newLevel = levels.find((item) => item.minXp <= newXp && (!item.maxXp || item.maxXp > newXp)).level;

            if (notify) {
                this.sendXpNotification(gainedXp, action);
            }

            return this.firebaseService.set(
                UserRatingDto,
                'rating',
                userId,
                new UserRatingDto({
                    userId,
                    gamesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    xp: newXp,
                    level: newLevel
                })
            ).pipe(catchError((err) => throwError(err)));
        }
    }

    public getUserRating(userId: string) {
        return this.rating$
            .pipe(
                map((ratings) => ratings.find((item) => item.userId === userId))
            );
    }

    public getRatingInfo(level: UserLevel) {
        return this.ratingInfo$
            .pipe(
                map((ratingInfos) => ratingInfos.find((item) => item.level === level))
            );
    }

    private getRewardPoints(action: UserAction) {
        return this.rewardPoints.get(action) || 0;
    }

    private sendXpNotification(gainedXp: number, action: UserAction) {
        return this.notificationService.addNotification({
            level: 'info',
            message: this.translateService.instant(
                'i18n.NOTIFICATIONS.GAINED_XP',
                { xp: gainedXp, action: this.gameInfoService.getFormattedUserAction(action).toLowerCase() }
            ),
            location: NotificationLocation.Aside
        });
    }
}
