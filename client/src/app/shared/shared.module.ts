import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatSliderModule } from '@angular/material/slider';
import { TranslateModule } from '@ngx-translate/core';
import { TooltipModule } from 'ng2-tooltip-directive';

import { GameInfoComponent } from './components/game-info/game-info.component';
import { GameLobbyComponent } from './components/game-lobby/game-lobby.component';
import { GameRoomsComponent } from './components/game-rooms/game-rooms.component';
import { ChooseUsernameDialogComponent } from './dialogs/choose-username-dialog/choose-username-dialog.component';
import { DevDialogComponent } from './dialogs/dev-dialog/dev-dialog.component';

const ANGULAR_MODULES = [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
];

const MATERIAL_MODULES = [
    MatDialogModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCheckboxModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSortModule,
    MatSliderModule
];

const OTHER_MODULES_IMPORT = [
    TooltipModule.forRoot({
        'max-width': 500,
        'hide-delay': 0,
        'animation-duration': 100,
        shadow: false
    }),
    TranslateModule
];
const OTHER_MODULES_EXPORT = [
    TooltipModule,
    TranslateModule
];

const COMPONENTS = [
    GameRoomsComponent,
    GameInfoComponent,
    GameLobbyComponent
];

const DIALOG_COMPONENTS = [
    ChooseUsernameDialogComponent,
    DevDialogComponent
];

@NgModule({
    declarations: [
        ...COMPONENTS,
        ...DIALOG_COMPONENTS
    ],
    imports: [
        ...ANGULAR_MODULES,
        ...MATERIAL_MODULES,
        ...OTHER_MODULES_IMPORT
    ],
    exports: [
        ...ANGULAR_MODULES,
        ...MATERIAL_MODULES,
        ...OTHER_MODULES_EXPORT,
        ...COMPONENTS,
        ...DIALOG_COMPONENTS
    ]
})
export class SharedModule { }
