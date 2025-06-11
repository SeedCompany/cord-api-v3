import { node, type Query } from 'cypher-query-builder';
import { e } from '~/core/gel';
import { INotificationStrategy, NotificationStrategy } from '../notifications';
import { SystemNotification } from './system-notification.dto';

@NotificationStrategy(SystemNotification)
export class SystemNotificationStrategy extends INotificationStrategy<SystemNotification> {
  recipientsForNeo4j() {
    return (query: Query) => query.match(node('recipient', 'User')).return('recipient');
  }

  recipientsForGel() {
    return e.User; // all users
  }
}
