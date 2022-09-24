import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Game } from '../../models/enums/game.enum';
import { ChooseUsernameDialogComponent } from '../../shared/dialogs/choose-username-dialog/choose-username-dialog.component';
import { UserResolver } from '../resolvers/user.resolver';
import { TokenService } from '../services/token.service';
import { UserService } from '../services/user.service';

@Injectable({
    providedIn: 'root'
})
export class UserGuard implements CanActivate {
    constructor(
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly dialog: MatDialog,
        private readonly userResolver: UserResolver,
        private readonly router: Router
    ) { }

    public canActivate(next: ActivatedRouteSnapshot) {
        return this.userResolver.resolve()
            .pipe(
                switchMap((user) => {
                    if (user) {
                        return of(true);
                    } else {
                        return this.dialog.open(ChooseUsernameDialogComponent)
                            .afterClosed()
                            .pipe(
                                switchMap((username: string) => {
                                    if (username) {
                                        return this.tokenService.guestSignIn(username)
                                            .pipe(
                                                map(() => !!this.userService.getCurrentUser())
                                            );
                                    } else {
                                        const requestedRoomId = next.paramMap.get('roomId');
                                        if (requestedRoomId) {
                                            // Navigate to the game lobby
                                            const selectedGame: Game = next.data.game;
                                            this.router.navigate(['/games', selectedGame.toLowerCase(), 'lobby']);
                                        } else {
                                            // Navigate to the login page
                                            this.router.navigate(['auth/signin']);
                                        }

                                        return of(false);
                                    }
                                })
                            );
                    }
                })
            );
    }
}
