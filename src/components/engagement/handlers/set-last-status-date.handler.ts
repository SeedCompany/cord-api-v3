import { DateTime } from 'luxon';
import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { EngagementStatus } from '../dto';
import { EngagementUpdatedEvent } from '../events';

@EventsHandler(EngagementUpdatedEvent)
export class SetLastStatusDate
  implements IEventHandler<EngagementUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    @Logger('engagement:set-last-status-date') private readonly logger: ILogger
  ) {}

  async handle(event: EngagementUpdatedEvent) {
    const { previous, updated, session } = event;
    if (previous.status === updated.status) {
      return;
    }

    try {
      const modifiedAt = updated.modifiedAt;
      const changes = {
        id: updated.id,
        statusModifiedAt: modifiedAt,
        lastSuspendedAt: (undefined as unknown) as DateTime,
        lastReactivatedAt: (undefined as unknown) as DateTime,
      };

      if (updated.status === EngagementStatus.Suspended) {
        changes.lastSuspendedAt = modifiedAt;
      }

      if (
        previous.status === EngagementStatus.Suspended &&
        updated.status === EngagementStatus.Active
      ) {
        changes.lastReactivatedAt = modifiedAt;
      }

      event.updated = await this.db.sgUpdateProperties({
        object: updated,
        session,
        props: ['statusModifiedAt', 'lastSuspendedAt', 'lastReactivatedAt'],
        changes,
        nodevar: 'Engagement',
      });
    } catch (exception) {
      this.logger.error(`Could not set last status date`, {
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not set last status date', exception);
    }
  }
}
