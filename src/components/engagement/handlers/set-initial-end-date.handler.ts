import { ServerException } from '~/common';
import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { EngagementStatus, LanguageEngagement } from '../dto';
import { EngagementRepository } from '../engagement.repository';
import { EngagementCreatedHook, EngagementUpdatedHook } from '../hooks';

type SubscribedEvent = EngagementCreatedHook | EngagementUpdatedHook;

@OnHook(EngagementCreatedHook)
@OnHook(EngagementUpdatedHook)
export class SetInitialEndDate {
  constructor(
    private readonly engagementRepo: EngagementRepository,
    private readonly config: ConfigService,
  ) {}

  async handle(event: SubscribedEvent) {
    if (this.config.databaseEngine === 'gel') {
      return;
    }

    const engagement = 'engagement' in event ? event.engagement : event.updated;

    if (
      event instanceof EngagementUpdatedHook && // allow setting initial if creating with non-in-dev status
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

      const type =
        LanguageEngagement.resolve(engagement) === LanguageEngagement
          ? 'Language'
          : 'Internship';
      await this.engagementRepo[`update${type}`](
        {
          id: engagement.id,
          initialEndDate: initialEndDate || null,
        },
        engagement.changeset,
      );

      const updatedEngagement = {
        ...engagement,
        initialEndDate,
      };

      if (event instanceof EngagementUpdatedHook) {
        event.updated = updatedEngagement;
      } else {
        event.engagement = updatedEngagement;
      }
    } catch (exception) {
      throw new ServerException(
        'Could not set initial end date on engagement',
        exception,
      );
    }
  }
}
