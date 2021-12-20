import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';

import { TokenService } from '../../../../core/services/token.service';

@Component({
    selector: 'gw-forgot-password-dialog',
    templateUrl: './forgot-password-dialog.component.html',
    styleUrls: ['./forgot-password-dialog.component.scss']
})
export class ForgotPasswordDialogComponent {
    public email = new FormControl(null, [Validators.required]);
    public mailSent = false;

    constructor(private readonly tokenService: TokenService) { }

    public remindPassword() {
        if (this.email.valid) {
            this.tokenService.remindPassword(this.email.value)
                .subscribe(
                    (password) => password,
                    () => {
                        this.mailSent = true;
                    }
                );
        }
    }
}
