import { CalendarDate, ServerException, Session } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { Engagement, EngagementStatus } from '../dto';
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
  private readonly languageEngagementTypeName = 'LanguageEngagement';

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, set initial end date', {
      ...event,
      event: event.constructor.name,
    });

    const engagement = 'engagement' in event ? event.engagement : event.updated;

    const shouldUpdateInitialEndDate =
      engagement.status === EngagementStatus.Active &&
      engagement.initialEndDate.value == null &&
      engagement.endDate.value != null;
    if (!shouldUpdateInitialEndDate) {
      return;
    }

    try {
      const initialEndDate = engagement.endDate.value!;

      const updatedEngagement = await this.updateEngagementInitialEndDate(
        engagement,
        initialEndDate,
        event.session
      );

      if (event instanceof EngagementUpdatedEvent) {
        event.updated = updatedEngagement;
      } else {
        event.engagement = updatedEngagement;
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

  private async updateEngagementInitialEndDate(
    engagement: Engagement,
    initialEndDate: CalendarDate,
    session: Session
  ) {
    const updateInput = {
      id: engagement.id,
      initialEndDate: initialEndDate,
    };
    // TODO: Refactor to call repository directly instead of engagementService methods
    if (engagement.__typename === this.languageEngagementTypeName) {
      return await this.engagementService.updateLanguageEngagement(
        updateInput,
        session
      );
    } else {
      return await this.engagementService.updateInternshipEngagement(
        updateInput,
        session
      );
    }
  }
}
