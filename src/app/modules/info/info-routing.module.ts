import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ContactsComponent } from './components/contacts/contacts.component';
import { FaqComponent } from './components/faq/faq.component';
import { DevGuard } from '../../core/guards/dev.guard';

const routes: Routes = [
    {
        path: 'faq',
        component: FaqComponent,
        canActivate: [DevGuard]
    },
    {
        path: 'contacts',
        component: ContactsComponent
    },
    {
        path: '**',
        redirectTo: 'faq',
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [CommonModule, RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class InfoRoutingModule { }
