import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { TokenService } from '../../../../core/services/token.service';
import { SignIn } from '../../../../models/sign-in.model';
import { ForgotPasswordDialogComponent } from '../../dialogs/forgot-password-dialog/forgot-password-dialog.component';

@Component({
    selector: 'gw-sign-in',
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnInit {
    public form: FormGroup;

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly dialog: MatDialog,
        private readonly tokenService: TokenService,
        private readonly router: Router
    ) { }

    public ngOnInit() {
        this.form = this.formBuilder.group({
            email: [null, [Validators.required, Validators.email]],
            password: [null, [Validators.required]]
        });
    }

    public signIn() {
        if (this.form.valid) {
            const data = new SignIn(this.form.getRawValue());
            this.tokenService.signIn(data)
                .subscribe(() => this.router.navigate(['account']));
        }
    }

    public openForgotPasswordModal() {
        this.dialog.open(ForgotPasswordDialogComponent)
            .afterClosed().subscribe((result) => console.log(result));
    }
}
