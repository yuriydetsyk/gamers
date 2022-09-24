import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, forkJoin, of, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { UserAction } from '../../models/enums/user-action';
import { SignIn } from '../../models/sign-in.model';
import { SignUp } from '../../models/sign-up.model';
import { FirebaseService } from './firebase.service';
import { HttpService } from './http.service';
import { RatingService } from './rating.service';
import { UserService } from './user.service';
import { GameInfoDto } from '../../models/dtos/game-info-dto.model';
import { Game } from '../../models/enums/game.enum';

@Injectable({
    providedIn: 'root'
})
export class TokenService implements OnDestroy {
    public isLogged$ = new BehaviorSubject<boolean>(false);
    public isGuest$ = new BehaviorSubject<boolean>(true);
    public get isLogged() {
        return this.isLogged$.value;
    }
    public get isGuest() {
        return this.isGuest$.value;
    }
    private subscription = new Subscription();

    constructor(
        private readonly httpService: HttpService,
        private readonly userService: UserService,
        private readonly firebaseService: FirebaseService,
        private readonly router: Router,
        private readonly ratingService: RatingService
    ) {
        this.subscription.add(
            this.userService.user$.subscribe((user) => {
                this.isLogged$.next(!!user);

                const isGuest = !!user && !!user.id && user.id.split('_')[0] === 'GUEST';
                this.isGuest$.next(isGuest);
            })
        );
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public signIn(body: SignIn) {
        return this.firebaseService.signIn(body)
            .pipe(
                switchMap((user) => {
                    if (!this.ratingService.getUserRating(user.id)) {
                        return forkJoin([
                            of(user),
                            this.ratingService.addXp(user.id, UserAction.SignIn, false)
                        ]).pipe(map(([userDto, _]) => userDto));
                    } else {
                        return of(user);
                    }
                })
            );
    }

    public guestSignIn(username: string) {
        return this.firebaseService.signInAnonymously(username)
            .pipe(
                switchMap((user) => {
                    return forkJoin([
                        of(user),
                        this.ratingService.addXp(user.id, UserAction.SignIn, false)
                    ]);
                }),
                map(([user, _]) => user)
            );
    }

    public signUp(body: SignUp) {
        return this.firebaseService.signUp(body)
            .pipe(
                switchMap((user) => this.ratingService.addXp(user.id, UserAction.SignUp, false)),
                switchMap(() => this.signIn(body.mapToSignInModel()))
            );
    }

    public signOut(doRedirect = true) {
        return this.firebaseService.signOut(this.isGuest)
            .pipe(
                map(() => {
                    if (doRedirect) {
                        this.router.navigate(['/']);
                        location.reload();
                    }
                })
            );
    }

    // TODO: implement remind password feature
    public remindPassword(email: string) {
        return this.httpService.get('remindPassword');
    }

    public getFirebaseUser() {
        return this.firebaseService.firebaseUser;
    }
}
