import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { TokenService } from '../../../../core/services/token.service';
import { UserService } from '../../../../core/services/user.service';
import { UserDto } from '../../../../models/dtos/user-dto.model';
import { Gender } from '../../../../models/enums/gender.enum';

@Component({
    selector: 'gw-account-info',
    templateUrl: './account-info.component.html',
    styleUrls: ['./account-info.component.scss']
})
export class AccountInfoComponent implements OnInit, OnDestroy {
    public user: UserDto;
    public form: FormGroup;
    @ViewChild('avatarUpload')
    public avatarUpload: ElementRef<HTMLInputElement>;
    public Gender = Gender;

    private subscription = new Subscription();

    constructor(
        private readonly userService: UserService,
        private readonly formBuilder: FormBuilder,
        private readonly tokenService: TokenService
    ) { }

    public ngOnInit() {
        this.createForm();

        this.subscription.add(
            this.userService.user$.subscribe((user) => {
                this.user = user;
                if (user) {
                    this.refreshForm(user);
                }
            })
        );
    }

    public ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    public uploadAvatar(files: FileList) {
        const file = files.item(0);
        if (!file) {
            return;
        }

        this.userService.uploadAvatar(file).subscribe();
    }

    public save() {
        if (this.form.valid) {
            this.userService.updateUser(this.form.getRawValue()).subscribe();
        }
    }

    public reset() {
        if (this.form) {
            this.form.reset(this.user);
        }
    }

    private createForm() {
        this.form = this.formBuilder.group({
            email: [null, [Validators.required, Validators.email]],
            username: null,
            firstName: null,
            lastName: null,
            gender: null,
            biography: null
        });
    }

    private refreshForm(user: UserDto) {
        this.form.setValue({
            email: this.tokenService.getFirebaseUser().email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            biography: user.biography
        });

        if (this.avatarUpload) {
            this.avatarUpload.nativeElement.value = '';
        }
    }
}
