import { ServerException } from '~/common';
import {
  ConfigService,
  EventsHandler,
  type IEventHandler,
  ILogger,
  Logger,
} from '~/core';
import { DatabaseService } from '~/core/database';
import { EngagementStatus, IEngagement } from '../dto';
import { EngagementUpdatedEvent } from '../events';

@EventsHandler(EngagementUpdatedEvent)
export class SetLastStatusDate
  implements IEventHandler<EngagementUpdatedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('engagement:set-last-status-date') private readonly logger: ILogger,
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
        type: IEngagement.resolve(updated),
        object: updated,
        changes,
      });
    } catch (exception) {
      this.logger.error(`Could not set last status date`, {
        userId: session.userId,
        exception,
      });
      throw this.config.jest
        ? exception
        : new ServerException('Could not set last status date', exception);
    }
  }
}
