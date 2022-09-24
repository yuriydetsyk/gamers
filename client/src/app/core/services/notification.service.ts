import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { NotificationLocation } from '../../models/enums/notification-location.enum';
import { SoundEffect } from '../../models/enums/sound-effect.enum';
import { Notification } from '../../models/interfaces/notification.interface';
import { AudioHelpers } from '../helpers/audio.helpers';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    public lastNotification$ = new Subject<Notification>();
    public notificationDuration = 4000;

    constructor(private readonly audioHelpers: AudioHelpers) { }

    public addNotification(notification: Notification) {
        this.lastNotification$.next(notification);

        if (notification.level !== 'error') {
            this.audioHelpers.playSound(SoundEffect.AlertInfo);
        } else {
            this.audioHelpers.playSound(SoundEffect.AlertDanger);
        }
    }

    public getNotificationClass(notification: Notification) {
        let cssClass = '';

        switch (notification.level) {
            case 'error':
                cssClass += 'alert-danger';
                break;
            case 'info':
                cssClass += 'alert-info';
                break;
            default:
                cssClass += 'alert-primary';
                break;
        }

        if (notification.location === NotificationLocation.Bottom) {
            cssClass += ' gw-notification-bottom';
        } else if (notification.location === NotificationLocation.Aside) {
            cssClass += ' gw-notification-aside';
        }

        return cssClass;
    }
}
