import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaqComponent } from './components/faq/faq.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { InfoRoutingModule } from './info-routing.module';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
    declarations: [FaqComponent, ContactsComponent],
    imports: [
        CommonModule,
        SharedModule,
        InfoRoutingModule
    ]
})
export class InfoModule { }
