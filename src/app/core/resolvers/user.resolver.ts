import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

import { UserDto } from '../../models/dtos/user-dto.model';
import { FirebaseService } from '../services/firebase.service';
import { UserService } from '../services/user.service';

@Injectable({
    providedIn: 'root'
})
export class UserResolver implements Resolve<Observable<UserDto>> {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly userService: UserService
    ) { }

    public resolve() {
        const user = this.userService.getCurrentUser();
        if (!user) {
            return this.firebaseService.getAuthState()
                .pipe(
                    take(1),
                    switchMap((authState) => {
                        if (authState) {
                            const id = this.firebaseService.getFormattedUserId(authState);
                            return this.firebaseService.getCurrentUser(id);
                        } else {
                            return of<UserDto>(null);
                        }
                    }),
                    map((userDto) => {
                        this.userService.setCurrentUser(userDto);
                        return userDto;
                    })
                );
        } else {
            return of(user);
        }
    }
}
