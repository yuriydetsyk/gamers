import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LoadingComponent } from './components/loading/loading/loading.component';

const COMPONENTS = [
    HeaderComponent,
    FooterComponent,
    SidebarComponent,
    LoadingComponent
];

@NgModule({
    declarations: [
        ...COMPONENTS,
        LoadingComponent
    ],
    imports: [
        CommonModule,
        RouterModule,
        SharedModule
    ],
    exports: [
        ...COMPONENTS
    ]
})
export class LayoutModule { }
