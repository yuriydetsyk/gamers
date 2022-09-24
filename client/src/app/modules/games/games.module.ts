import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { GamesComponent } from './components/games/games.component';
import { GamesRoutingModule } from './games-routing.module';

@NgModule({
    declarations: [
        GamesComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        GamesRoutingModule
    ]
})
export class GamesModule {
    constructor() { }
}
