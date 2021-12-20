import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';

import { GameComponent } from '../../modules/games/components/game/game.component';
import { MediaService } from '../services/media.service';

@Injectable({
    providedIn: 'root'
})
export class MediaGuard implements CanDeactivate<GameComponent> {
    constructor(private readonly mediaService: MediaService) { }

    public canDeactivate() {
        this.mediaService.stopUserMedia();
        return true;
    }
}
