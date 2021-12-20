import { ErrorHandler, Injectable } from '@angular/core';

import { NotificationLocation } from '../../models/enums/notification-location.enum';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class ErrorsHandler implements ErrorHandler {
    public constructor(private readonly notificationService: NotificationService) { }

    public handleError(error: any) {
        this.notificationService.addNotification({
            level: 'error',
            message: error.message,
            stack: error.stack,
            location: NotificationLocation.Bottom
        });

        console.error(error);
    }
}
