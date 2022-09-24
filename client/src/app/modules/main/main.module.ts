import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './components/home/home.component';
import { MainRoutingModule } from './main-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { RatingComponent } from './components/rating/rating.component';
import { PremiumComponent } from './components/premium/premium.component';

@NgModule({
    declarations: [
        HomeComponent,
        RatingComponent,
        PremiumComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        MainRoutingModule
    ]
})
export class MainModule {
    constructor() { }
}
