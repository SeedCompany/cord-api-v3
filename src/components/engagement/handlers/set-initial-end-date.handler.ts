import {
  CalendarDate,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Engagement, EngagementStatus } from '../dto';
import { EngagementService } from '../engagement.service';
import { EngagementCreatedEvent, EngagementUpdatedEvent } from '../events';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class SetInitialEndDate implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly engagementService: EngagementService,
    @Logger('engagement:set-initial-end-date') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, set initial end date', {
      ...event,
      event: event.constructor.name,
    });

    const engagement = 'engagement' in event ? event.engagement : event.updated;

    if (event instanceof EngagementCreatedEvent && engagement.changeset) {
      return;
    }
    if (
      event instanceof EngagementUpdatedEvent && // allow setting initial if creating with non-in-dev status
      engagement.status.value !== EngagementStatus.InDevelopment
    ) {
      return;
    }
    if (!engagement.endDate.canRead) {
      throw new UnauthorizedException(
        `Current user cannot read Engagement's end date thus initial end date cannot be set`
      );
    }
    if (!engagement.initialEndDate.canRead) {
      throw new UnauthorizedException(
        `Current user cannot read Engagement's initial end date thus initial end date cannot be set`
      );
    }
    if (
      engagement.initialEndDate.value?.toMillis() ===
      engagement.endDate.value?.toMillis()
    ) {
      return;
    }

    try {
      const initialEndDate = engagement.endDate.value;

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
    initialEndDate: CalendarDate | null | undefined,
    session: Session
  ) {
    const updateInput = {
      id: engagement.id,
      initialEndDate: initialEndDate || null,
    };
    // TODO: Refactor to call repository directly instead of engagementService methods
    if (engagement.__typename === 'LanguageEngagement') {
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
