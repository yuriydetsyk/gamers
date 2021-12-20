import { AfterViewInit, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DomSanitizer } from '@angular/platform-browser';
import { combineLatest, merge, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { GameInfoService } from '../../../../core/services/game-info.service';
import { RatingService } from '../../../../core/services/rating.service';
import { UserService } from '../../../../core/services/user.service';
import { UserLevel } from '../../../../models/enums/user-level.enum';
import { RatingView } from '../../../../models/views/rating-view.model';

@Component({
    selector: 'gw-rating',
    templateUrl: './rating.component.html',
    styleUrls: ['./rating.component.scss']
})
export class RatingComponent implements AfterViewInit {
    @ViewChild(MatPaginator) public paginator: MatPaginator;
    @ViewChild(MatSort) public sort: MatSort;
    public displayedColumns = ['index', 'user', 'xp', 'level', 'games', 'wins', 'losses', 'winRate'];
    public data: RatingView[] = [];
    public dataLength = 0;
    public isLoading = true;
    public UserLevel = UserLevel;
    public get isMissingData() {
        return !this.isLoading && !this.data.length;
    }

    constructor(
        private readonly userService: UserService,
        private readonly ratingService: RatingService,
        private readonly cdr: ChangeDetectorRef,
        private readonly sanitizer: DomSanitizer,
        private readonly gameInfoService: GameInfoService
    ) { }

    public ngAfterViewInit() {
        // If the user changes the sort order, reset back to the first page.
        this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0);

        merge(of(true), this.sort.sortChange, this.paginator.page)
            .pipe(
                tap(() => {
                    this.isLoading = true;
                    this.cdr.detectChanges();
                }),
                switchMap(() => {
                    return combineLatest([
                        this.ratingService.rating$,
                        this.userService.users$
                    ]);
                }),
                map(([rating, users]) => {
                    const data = RatingView.mapFromDtoBulk(
                        rating.sort((a, b) => {
                                if (this.sort.direction === 'asc') {
                                    return a.xp - b.xp;
                                } else {
                                    return b.xp - a.xp;
                                }
                            }),
                        users
                    );

                    this.dataLength = data.length;

                    return data.slice(
                        this.paginator.pageIndex * this.paginator.pageSize,
                        this.paginator.pageIndex * this.paginator.pageSize + this.paginator.pageSize
                    );
                }),
                tap(() => {
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }),
                catchError(() => {
                    this.isLoading = false;
                    this.cdr.detectChanges();
                    return of([]);
                })
            )
            .subscribe((data) => {
                this.data = data;
                this.cdr.detectChanges();
            });
    }

    public getWinRate(row: RatingView) {
        return row.gamesPlayed ? row.wins / row.gamesPlayed : 0;
    }

    public getPlace(index: number) {
        index += 1;
        return this.paginator.pageIndex === 0 ? index : index + this.paginator.pageIndex * this.paginator.pageSize;
    }

    public getAvatarUrl(row: RatingView) {
        return this.sanitizer.bypassSecurityTrustStyle(`url(${row.user.getAvatarUrl()})`);
    }

    public getFormattedUserLevel(level: UserLevel) {
        return this.gameInfoService.getFormattedUserLevel(level);
    }
}
