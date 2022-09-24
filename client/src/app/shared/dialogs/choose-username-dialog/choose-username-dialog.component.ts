import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'gw-choose-username-dialog',
    templateUrl: './choose-username-dialog.component.html',
    styleUrls: ['./choose-username-dialog.component.scss']
})
export class ChooseUsernameDialogComponent {
    public username = new FormControl(null, [Validators.required]);
    public mailSent = false;

    constructor(private readonly dialogRef: MatDialogRef<ChooseUsernameDialogComponent>) { }

    public submitUsername() {
        if (this.username.valid) {
            this.dialogRef.close(this.username.value);
        }
    }
}
