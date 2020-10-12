import { DateTime } from 'luxon';
import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { EngagementService } from '../engagement.service';
import { EngagementUpdatedEvent } from '../events';

@EventsHandler(EngagementUpdatedEvent)
export class SetInitialEndDate
  implements IEventHandler<EngagementUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService,
    @Logger('engagement:set-last-status-date') private readonly logger: ILogger
  ) {}

  async handle({ updated, session }: EngagementUpdatedEvent) {
    try {
      const modifiedAt = DateTime.local();
      // await this.db
      //   .query()
      //   .match([node('engagement', 'Engagement', { id: previous.id })])
      //   .run();
      updated = await this.db.sgUpdateProperty({
        object: updated,
        session,
        key: 'statusModifiedAt',
        value: modifiedAt,
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
