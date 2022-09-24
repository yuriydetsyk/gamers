import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TokenService } from '../../../../core/services/token.service';
import { Gender } from '../../../../models/enums/gender.enum';
import { SignUp } from '../../../../models/sign-up.model';

@Component({
    selector: 'gw-sign-up',
    templateUrl: './sign-up.component.html',
    styleUrls: ['./sign-up.component.scss']
})
export class SignUpComponent implements OnInit {
    public form: FormGroup;
    public Gender = Gender;

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly tokenService: TokenService,
        private readonly router: Router
    ) { }

    public ngOnInit() {
        this.form = this.formBuilder.group({
            email: [null, [Validators.required, Validators.email]],
            password: [null, [Validators.required, Validators.minLength(6)]],
            gender: null,
            biography: null
        });
    }

    public signUp() {
        if (this.form.valid) {
            const data = new SignUp(this.form.getRawValue());
            this.tokenService.signUp(data)
                .subscribe(() => this.router.navigate(['account']));
        }
    }

    public reset() {
        if (this.form) {
            this.form.reset();
        }
    }
}
