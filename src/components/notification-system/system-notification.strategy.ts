import { INotificationStrategy, NotificationStrategy } from '../notifications';
import { SystemNotification } from './system-notification.dto';

@NotificationStrategy(SystemNotification)
export class SystemNotificationStrategy extends INotificationStrategy<SystemNotification> {}
