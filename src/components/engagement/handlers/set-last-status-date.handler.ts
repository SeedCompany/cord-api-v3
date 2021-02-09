import { keys, ServerException } from '../../../common';
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
    if (previous.status.value === updated.status.value) {
      return;
    }

    try {
      const modifiedAt = updated.modifiedAt;
      const changes = {
        statusModifiedAt: modifiedAt,
        ...(updated.status.value === EngagementStatus.Suspended
          ? {
              lastSuspendedAt: modifiedAt,
            }
          : {}),
        ...(previous.status.value === EngagementStatus.Suspended &&
        updated.status.value === EngagementStatus.Active
          ? {
              lastReactivatedAt: modifiedAt,
            }
          : {}),
      } as const;

      event.updated = await this.db.sgUpdateProperties({
        object: updated,
        session,
        props: keys(changes as Required<typeof changes>),
        changes: {
          id: updated.id,
          ...changes,
        },
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
