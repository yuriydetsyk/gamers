import { LogLevel } from 'firebase/app';
import { NotificationLocation } from '../enums/notification-location.enum';

export interface Notification {
    level: LogLevel;
    message: string;
    stack?: string;
    location: NotificationLocation;
}
