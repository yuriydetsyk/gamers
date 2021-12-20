import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { RatingComponent } from './components/rating/rating.component';
import { PremiumComponent } from './components/premium/premium.component';
import { DevGuard } from '../../core/guards/dev.guard';

const routes: Routes = [
    {
        path: '',
        component: HomeComponent,
        data: { showFooter: true }
    },
    {
        path: 'rating',
        component: RatingComponent
    },
    {
        path: 'premium',
        component: PremiumComponent,
        canActivate: [DevGuard]
    }
];

@NgModule({
    imports: [CommonModule, RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class MainRoutingModule { }
