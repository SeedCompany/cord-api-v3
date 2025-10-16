import { type Notification } from './notification.dto';

export class NotificationAdded {
  constructor(readonly notification: Notification) {}
}
