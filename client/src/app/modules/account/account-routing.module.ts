import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AccountInfoComponent } from './components/account-info/account-info.component';
import { AccountComponent } from './components/account/account.component';
import { AccountStatsComponent } from './components/account-stats/account-stats.component';

const routes: Routes = [
    {
        path: '',
        component: AccountComponent,
        children: [
            {
                path: '',
                component: AccountInfoComponent
            },
            {
                path: 'stats',
                component: AccountStatsComponent
            }
        ]
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
export class AccountRoutingModule { }
