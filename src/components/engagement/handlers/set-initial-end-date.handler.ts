import {
  CalendarDate,
  ID,
  ServerException,
  UnsecuredDto,
} from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import {
  Engagement,
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
  PublicationEngagement,
} from '../dto';
import { EngagementRepository } from '../engagement.repository';
import { EngagementService } from '../engagement.service';
import { EngagementCreatedEvent, EngagementUpdatedEvent } from '../events';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class SetInitialEndDate implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly engagementRepo: EngagementRepository,
    private readonly engagementService: EngagementService,
    @Logger('engagement:set-initial-end-date') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, set initial end date', {
      ...event,
      event: event.constructor.name,
    });

    const engagement = 'engagement' in event ? event.engagement : event.updated;

    if (
      event instanceof EngagementUpdatedEvent && // allow setting initial if creating with non-in-dev status
      engagement.status !== EngagementStatus.InDevelopment
    ) {
      return;
    }
    if (
      engagement.initialEndDate?.toMillis() === engagement.endDate?.toMillis()
    ) {
      return;
    }

    try {
      const initialEndDate = engagement.endDate;

      await this.updateEngagementInitialEndDate(
        engagement,
        initialEndDate,
        engagement.changeset
      );
      const updatedEngagement = {
        ...engagement,
        initialEndDate,
      };

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
    engagement: UnsecuredDto<Engagement>,
    initialEndDate: CalendarDate | null | undefined,
    changeset?: ID
  ) {
    const updateInput = {
      initialEndDate: initialEndDate || null,
    };
    if (engagement.__typename === 'LanguageEngagement') {
      await this.engagementRepo.updateLanguageProperties(
        engagement as UnsecuredDto<LanguageEngagement>,
        updateInput,
        changeset
      );
    } else if (engagement.__typename === 'InternshipEngagement') {
      await this.engagementRepo.updateInternshipProperties(
        engagement as UnsecuredDto<InternshipEngagement>,
        updateInput,
        changeset
      );
    } else {
      await this.engagementRepo.updatePublicationProperties(
        engagement as UnsecuredDto<PublicationEngagement>,
        updateInput,
        changeset
      );
    }
  }
}
