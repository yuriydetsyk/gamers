import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MediaGuard } from '../../../../core/guards/media.guard';
import { PeerGuard } from '../../../../core/guards/peer.guard';
import { RoomGuard } from '../../../../core/guards/room.guard';
import { UserGuard } from '../../../../core/guards/user.guard';
import { Game } from '../../../../models/enums/game.enum';
import { GameLobbyComponent } from '../../../../shared/components/game-lobby/game-lobby.component';
import { NechtoComponent } from './components/nechto/nechto.component';
import { UserAndRoomGuard } from '../../../../core/guards/user-and-room.guard';

const routes: Routes = [
    {
        path: '',
        data: { game: Game.Nechto },
        children: [
            {
                path: '',
                redirectTo: 'lobby',
            },
            {
                path: 'lobby',
                canActivate: [RoomGuard],
                component: GameLobbyComponent
            },
            {
                path: ':roomId',
                component: NechtoComponent,
                canActivate: [UserAndRoomGuard],
                canDeactivate: [MediaGuard, PeerGuard, RoomGuard],
                data: { showSidebar: true }
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
export class NechtoRoutingModule { }
