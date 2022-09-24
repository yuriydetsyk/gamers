import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import {
    ForgotPasswordDialogComponent,
} from './dialogs/forgot-password-dialog/forgot-password-dialog.component';

@NgModule({
    declarations: [
        SignInComponent,
        SignUpComponent,
        ForgotPasswordDialogComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        AuthRoutingModule
    ]
})
export class AuthModule { }
