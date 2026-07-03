import { node, type Query } from 'cypher-query-builder';
import { type ID } from '~/common';
import { type DrizzleDb, users } from '~/core/drizzle';
import { e } from '~/core/gel';
import {
  INotificationStrategy,
  type NotificationRow,
  NotificationStrategy,
} from '../notifications';
import { SystemNotification } from './system-notification.dto';

@NotificationStrategy(SystemNotification)
export class SystemNotificationStrategy extends INotificationStrategy<SystemNotification> {
  recipientsForNeo4j() {
    return (query: Query) =>
      query.match(node('recipient', 'User')).return('recipient');
  }

  recipientsForGel() {
    return e.User; // all users
  }

  override async recipientsForDrizzle(
    _input: unknown,
    db: DrizzleDb,
  ): Promise<ReadonlyArray<ID<'User'>>> {
    const rows = await db.select({ id: users.id }).from(users);
    return rows.map((row) => row.id);
  }

  override hydrateExtraForDrizzle(row: NotificationRow) {
    return { message: row.message };
  }

  broadcastTo() {
    return ['system'];
  }
}
