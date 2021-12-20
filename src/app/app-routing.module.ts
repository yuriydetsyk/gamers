import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AnonGuard } from './core/guards/anon.guard';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
    {
        path: '',
        children: [
            {
                path: '',
                loadChildren: () => import('./modules/main/main.module').then((m) => m.MainModule)
            },
            {
                path: 'auth',
                loadChildren: () => import('./modules/auth/auth.module').then((m) => m.AuthModule),
                canLoad: [AnonGuard],
                data: { showFooter: true }
            },
            {
                path: 'games',
                loadChildren: () => import('./modules/games/games.module').then((m) => m.GamesModule)
            },
            {
                path: 'account',
                loadChildren: () => import('./modules/account/account.module').then((m) => m.AccountModule),
                canLoad: [AuthGuard]
            },
            {
                path: 'info',
                loadChildren: () => import('./modules/info/info.module').then((m) => m.InfoModule)
            }
        ]
    },
    {
        path: '**',
        redirectTo: '', // Can be 'Not Found' page
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {
        paramsInheritanceStrategy: 'always'
    })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
