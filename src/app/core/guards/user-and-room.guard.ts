import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { PipeHelpers } from '../helpers/pipe.helpers';
import { RoomGuard } from './room.guard';
import { UserGuard } from './user.guard';

@Injectable({
    providedIn: 'root'
})
export class UserAndRoomGuard implements CanActivate {
    constructor(
        private readonly userGuard: UserGuard,
        private readonly roomGuard: RoomGuard,
        private readonly pipeHelpers: PipeHelpers
    ) { }

    public canActivate(next: ActivatedRouteSnapshot) {
        return this.userGuard.canActivate(next).pipe(
            this.pipeHelpers.startRequestPipe,
            switchMap((res) => {
                if (res) {
                    return this.roomGuard.canActivate(next);
                } else {
                    return of(false);
                }
            }),
            this.pipeHelpers.endRequestPipe
        );
    }
}
