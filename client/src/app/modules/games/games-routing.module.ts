import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Game } from '../../models/enums/game.enum';
import { GamesComponent } from './components/games/games.component';

const routes: Routes = [
    {
        path: '',
        component: GamesComponent,
        data: { showFooter: true }
    },
    {
        path: Game.Nechto.toLowerCase(),
        loadChildren: () => import('./modules/nechto/nechto.module').then((m) => m.NechtoModule)
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [CommonModule, RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class GamesRoutingModule { }
