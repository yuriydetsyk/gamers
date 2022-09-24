import { Injectable } from '@angular/core';
import { CanActivate, CanLoad, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { FirebaseService } from '../services/firebase.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanLoad {
    constructor(
        private readonly router: Router,
        private readonly firebaseService: FirebaseService
    ) { }

    public canActivate() {
        return this.canProceed();
    }

    public canLoad() {
        return this.canProceed();
    }

    private canProceed() {
        return this.firebaseService.getAuthState()
            .pipe(
                take(1),
                map((authState) => {
                    if (authState) {
                        return true;
                    } else {
                        // Navigate to the login page
                        this.router.navigate(['auth/signin']);

                        return false;
                    }
                })
            );
    }
}
