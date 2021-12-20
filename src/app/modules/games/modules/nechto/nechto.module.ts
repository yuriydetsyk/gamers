import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NechtoRoutingModule } from './nechto-routing.module';
import { NechtoComponent } from './components/nechto/nechto.component';
import { NechtoPlayerComponent } from './components/nechto-player/nechto-player.component';
import { NechtoCardComponent } from './components/nechto-card/nechto-card.component';
import { NechtoTableComponent } from './components/nechto-table/nechto-table.component';
import { SharedModule } from '../../../../shared/shared.module';


@NgModule({
    declarations: [NechtoComponent, NechtoPlayerComponent, NechtoCardComponent, NechtoTableComponent],
    imports: [
        CommonModule,
        SharedModule,
        NechtoRoutingModule
    ]
})
export class NechtoModule { }
