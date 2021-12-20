import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountInfoComponent } from './components/account-info/account-info.component';
import { AccountRoutingModule } from './account-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { AccountStatsComponent } from './components/account-stats/account-stats.component';
import { AccountComponent } from './components/account/account.component';

@NgModule({
    declarations: [AccountInfoComponent, AccountStatsComponent, AccountComponent],
    imports: [
        CommonModule,
        SharedModule,
        AccountRoutingModule
    ]
})
export class AccountModule {
    constructor() { }
 }
