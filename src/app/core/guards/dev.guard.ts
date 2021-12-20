import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanActivate, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { DevDialogComponent } from '../../shared/dialogs/dev-dialog/dev-dialog.component';

@Injectable({
    providedIn: 'root'
})
export class DevGuard implements CanActivate {
    constructor(
        private readonly dialog: MatDialog,
        private readonly router: Router
    ) { }

    public canActivate() {
        return this.canProceed();
    }

    public canLoad() {
        return this.canProceed();
    }

    private canProceed() {
        return this.dialog.open(DevDialogComponent)
            .afterClosed()
            .pipe(
                map(() => {
                    this.router.navigate(['']);
                    return false;
                })
            );
    }
}
