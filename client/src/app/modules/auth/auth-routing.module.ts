import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { AnonGuard } from '../../core/guards/anon.guard';

const routes: Routes = [
    {
        path: 'signin',
        component: SignInComponent,
        canActivate: [AnonGuard]
    },
    {
        path: 'signup',
        component: SignUpComponent,
        canActivate: [AnonGuard]
    },
    {
        path: '**',
        redirectTo: 'signin',
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [CommonModule, RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AuthRoutingModule { }
