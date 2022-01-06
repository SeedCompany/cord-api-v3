import { DateInterval, UnsecuredDto } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import {
  Engagement,
  engagementRange,
  EngagementService,
} from '../../engagement';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';
import {
  AbstractPeriodicReportSync,
  Intervals,
} from './abstract-periodic-report-sync';

type SubscribedEvent =
  | EngagementCreatedEvent
  | EngagementUpdatedEvent
  | ProjectUpdatedEvent;

@EventsHandler(
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
  ProjectUpdatedEvent
)
export class SyncProgressReportToEngagementDateRange
  extends AbstractPeriodicReportSync
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    periodicReports: PeriodicReportService,
    private readonly engagements: EngagementService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger
  ) {
    super(periodicReports);
  }

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, syncing progress reports', {
      ...event,
      event: event.constructor.name,
    });

    if (
      (event instanceof EngagementCreatedEvent && event.engagement.changeset) ||
      (event instanceof EngagementUpdatedEvent && event.updated.changeset)
    ) {
      // Progress reports are not changeset aware yet. Skip processing this
      // until changeset is approved and another update event is fired.
      return;
    }

    const engagements =
      event instanceof ProjectUpdatedEvent
        ? await this.engagements.listAllByProjectId(
            event.updated.id,
            event.session
          )
        : event instanceof EngagementUpdatedEvent
        ? [event.updated]
        : [event.engagement];

    for (const engagement of engagements) {
      const [prev, updated] =
        event instanceof ProjectUpdatedEvent
          ? this.intervalsFromProjectChange(engagement, event)
          : event instanceof EngagementCreatedEvent
          ? [null, engagementRange(event.engagement)]
          : [engagementRange(event.previous), engagementRange(event.updated)];

      const diff = this.diffBy(updated, prev, 'quarter');

      await this.sync(
        event.session,
        engagement.id,
        ReportType.Progress,
        diff,
        engagement.endDate?.endOf('quarter')
      );
    }
  }

  private intervalsFromProjectChange(
    engagement: UnsecuredDto<Engagement>,
    event: ProjectUpdatedEvent
  ): Intervals {
    return [
      // Engagement already has all the updated values calculated correctly.
      engagementRange(engagement),
      // For previous, there's no change if there was an override,
      // otherwise it's the project's previous
      DateInterval.tryFrom(
        engagement.startDateOverride ?? event.previous.mouStart,
        engagement.endDateOverride ?? event.previous.mouEnd
      ),
    ];
  }
}
