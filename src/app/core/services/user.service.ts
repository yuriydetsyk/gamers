import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, forkJoin, of, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { UserDto } from '../../models/dtos/user-dto.model';
import { UserAction } from '../../models/enums/user-action';
import { FirebaseService } from './firebase.service';
import { RatingService } from './rating.service';

@Injectable({
    providedIn: 'root'
})
export class UserService implements OnDestroy {
    public user$ = new BehaviorSubject<UserDto>(null);
    public users$ = new BehaviorSubject<UserDto[]>([]);
    public get users() {
        return this.users$.getValue();
    }

    private destroy$ = new Subject<void>();

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly ratingService: RatingService
    ) {
        this.firebaseService.getAuthState()
            .pipe(
                switchMap((authState) => {
                    if (authState) {
                        const id = this.firebaseService.getFormattedUserId(authState);
                        return this.firebaseService.getCurrentUser(id);
                    } else {
                        return of<UserDto>(null);
                    }
                }),
                map((user) => {
                    this.setCurrentUser(user);
                    return user;
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        this.firebaseService.listen(UserDto, 'users')
            .pipe(
                tap((users) => {
                    const currentUserId = this.getCurrentUserId();
                    if (currentUserId) {
                        const user = users.find((item) => item.id === currentUserId);
                        this.setCurrentUser(user);
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe((users) => this.users$.next(users));
    }

    public ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public setCurrentUser(user: UserDto) {
        this.user$.next(user);
    }

    public getCurrentUser() {
        return this.user$.getValue();
    }

    public getCurrentUserId() {
        const user = this.user$.getValue();
        return user ? user.id : null;
    }

    public getUser(userId: string) {
        return this.users.find((item) => item.id === userId);
    }

    public uploadAvatar(file: File) {
        const userId = this.getCurrentUserId();

        // Upload the file and metadata
        return this.firebaseService.uploadFile(file, userId)
            .pipe(
                switchMap((url) => this.firebaseService.update(UserDto, 'users', userId, { avatar: url })),
                switchMap((user) => {
                    // Check if user previously did not fill all data, but now he has all the data
                    if (!user.hasFilledData && user.hasAllData()) {
                        return forkJoin([
                            this.firebaseService.update(UserDto, 'users', userId, { hasFilledData: true }),
                            this.ratingService.addXp(userId, UserAction.FillUserInfo)
                        ]);
                    } else {
                        return of(true);
                    }
                })
            );
    }

    public updateUser(data: Partial<UserDto>) {
        const userId = this.getCurrentUserId();

        return this.firebaseService.update(UserDto, 'users', userId, data)
            .pipe(
                switchMap((user) => {
                    // Check if user previously did not fill all data, but now he has all the data
                    if (!user.hasFilledData && user.hasAllData()) {
                        return forkJoin([
                            this.firebaseService.update(UserDto, 'users', userId, { hasFilledData: true }),
                            this.ratingService.addXp(userId, UserAction.FillUserInfo)
                        ]);
                    } else {
                        return of(true);
                    }
                })
            );
    }
}
