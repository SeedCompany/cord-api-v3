import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import {
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
} from '../dto';
import { EngagementUpdatedEvent } from '../events';

@EventsHandler(EngagementUpdatedEvent)
export class SetLastStatusDate
  implements IEventHandler<EngagementUpdatedEvent>
{
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
        statusModifiedAt: modifiedAt,
        ...(updated.status === EngagementStatus.Suspended
          ? {
              lastSuspendedAt: modifiedAt,
            }
          : {}),
        ...(previous.status === EngagementStatus.Suspended &&
        updated.status === EngagementStatus.Active
          ? {
              lastReactivatedAt: modifiedAt,
            }
          : {}),
      } as const;

      event.updated = await this.db.updateProperties({
        type:
          updated.__typename === 'LanguageEngagement'
            ? LanguageEngagement
            : InternshipEngagement,
        object: updated,
        changes,
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
