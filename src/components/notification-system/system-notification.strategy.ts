import { node, Query } from 'cypher-query-builder';
import { e } from '~/core/edgedb';
import { INotificationStrategy, NotificationStrategy } from '../notifications';
import { SystemNotification } from './system-notification.dto';

@NotificationStrategy(SystemNotification)
export class SystemNotificationStrategy extends INotificationStrategy<SystemNotification> {
  recipientsForNeo4j() {
    return (query: Query) =>
      query.match(node('recipient', 'User')).return('recipient');
  }

  recipientsForEdgeDB() {
    return e.User; // all users
  }
}
