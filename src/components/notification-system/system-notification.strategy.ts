import { isNull } from 'drizzle-orm';
import { type ID } from '~/common';
import { type DrizzleDb, users } from '~/core/drizzle';
import {
  INotificationStrategy,
  type NotificationRow,
  NotificationStrategy,
} from '../notifications';
import { SystemNotification } from './system-notification.dto';

@NotificationStrategy(SystemNotification)
export class SystemNotificationStrategy extends INotificationStrategy<SystemNotification> {
  override async recipientsForDrizzle(
    _input: unknown,
    db: DrizzleDb,
  ): Promise<ReadonlyArray<ID<'User'>>> {
    // User deletion is a soft delete, so filter explicitly.
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.deletedAt));
    return rows.map((row) => row.id);
  }

  override hydrateExtraForDrizzle(row: NotificationRow) {
    return { message: row.message };
  }

  broadcastTo() {
    return ['system'];
  }
}
