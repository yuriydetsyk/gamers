import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { FirebaseService } from '../services/firebase.service';

@Injectable({
    providedIn: 'root'
})
export class AnonGuard implements CanActivate {
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
                    if (!authState) {
                        return true;
                    } else {
                        // Navigate to the main page
                        this.router.navigate(['/']);

                        return false;
                    }
                })
            );
    }
}
