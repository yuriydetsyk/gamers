import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subject } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';

import { GameInfoService } from '../../../../core/services/game-info.service';
import { RatingService } from '../../../../core/services/rating.service';
import { UserService } from '../../../../core/services/user.service';
import { RatingInfoDto } from '../../../../models/dtos/rating-info-dto.model';
import { UserLevel } from '../../../../models/enums/user-level.enum';
import { RatingView } from '../../../../models/views/rating-view.model';

@Component({
    selector: 'gw-account-stats',
    templateUrl: './account-stats.component.html',
    styleUrls: ['./account-stats.component.scss']
})
export class AccountStatsComponent implements OnInit, OnDestroy {
    public rating: RatingView;
    public ratingInfo: RatingInfoDto;
    public UserLevel = UserLevel;

    private destroy$ = new Subject<void>();

    constructor(
        private readonly ratingService: RatingService,
        private readonly userService: UserService,
        private readonly gameInfoService: GameInfoService
    ) { }

    public ngOnInit() {
        combineLatest([
            this.ratingService.rating$,
            this.userService.user$
        ])
            .pipe(
                switchMap(() => this.ratingService.getUserRating(this.userService.getCurrentUserId())),
                switchMap((rating) => {
                    this.rating = RatingView.mapFromDto(rating, this.userService.getCurrentUser());

                    return this.ratingService.getRatingInfo(rating ? rating.level : null);
                }),
                map((ratingInfo) => this.ratingInfo = ratingInfo),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public getWinRate() {
        return this.rating.gamesPlayed ? this.rating.wins / this.rating.gamesPlayed : 0;
    }

    public getFormattedUserLevel(level: UserLevel) {
        return this.gameInfoService.getFormattedUserLevel(level);
    }
}
