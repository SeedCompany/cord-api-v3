import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { EngagementStatus } from '../dto';
import { EngagementService } from '../engagement.service';
import { EngagementCreatedEvent, EngagementUpdatedEvent } from '../events';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class SetInitialEndDate implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService,
    @Logger('engagement:set-initial-end-date') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, set initial end date', {
      ...event,
      event: event.constructor.name,
    });

    const languageEngagementTypeName = 'LanguageEngagement';
    const internshipEngagementTypeName = 'LanguageEngagement';
    const engagement = 'engagement' in event ? event.engagement : event.updated;

    const shouldUpdateInitialEndDate =
      engagement.status === EngagementStatus.Active &&
      engagement.initialEndDate.value == null &&
      engagement.endDate.value != null;

    if (shouldUpdateInitialEndDate) {
      try {
        const updateInput = {
          id: engagement.id,
          initialEndDate: engagement.endDate.value!,
        };

        if (engagement.__typename === languageEngagementTypeName) {
          await this.engagementService.updateLanguageEngagement(
            updateInput,
            event.session
          );
        } else if (engagement.__typename === internshipEngagementTypeName) {
          await this.engagementService.updateInternshipEngagement(
            updateInput,
            event.session
          );
        }
      } catch (exception) {
        this.logger.error(`Could not set initial end date on engagement`, {
          userId: event.session.userId,
          exception,
        });
        throw new ServerException(
          'Could set initial end date on engagement',
          exception
        );
      }
    }
  }
}
