import { DateInterval, type UnsecuredDto } from '~/common';
import { EventsHandler, type IEventHandler, ILogger, Logger } from '~/core';
import { EngagementService } from '../../engagement';
import { type Engagement, engagementRange } from '../../engagement/dto';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';
import {
  AbstractPeriodicReportSync,
  type Intervals,
} from './abstract-periodic-report-sync';

type SubscribedEvent =
  | EngagementCreatedEvent
  | EngagementUpdatedEvent
  | ProjectUpdatedEvent;

@EventsHandler(
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
  ProjectUpdatedEvent,
)
export class SyncProgressReportToEngagementDateRange
  extends AbstractPeriodicReportSync
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    periodicReports: PeriodicReportService,
    private readonly engagements: EngagementService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger,
  ) {
    super(periodicReports);
  }

  async handle(event: SubscribedEvent) {
    // Only LanguageEngagements
    if (
      !(
        ((event instanceof EngagementCreatedEvent ||
          event instanceof EngagementUpdatedEvent) &&
          event.isLanguageEngagement()) ||
        (event instanceof ProjectUpdatedEvent &&
          event.updated.type.includes('Translation'))
      )
    ) {
      return;
    }

    if (
      event instanceof ProjectUpdatedEvent &&
      event.changes.mouStart === undefined &&
      event.changes.mouEnd === undefined
    ) {
      // Project dates haven't changed, so do nothing.
      return;
    }
    if (
      event instanceof EngagementUpdatedEvent &&
      event.input.startDateOverride === undefined &&
      event.input.endDateOverride === undefined
    ) {
      // Engagement dates haven't changed, so do nothing.
      return;
    }

    if (
      (event instanceof EngagementCreatedEvent && event.engagement.changeset) ||
      (event instanceof EngagementUpdatedEvent && event.updated.changeset)
    ) {
      // Progress reports are not changeset aware yet. Skip processing this
      // until changeset is approved and another update event is fired.
      return;
    }

    this.logger.debug('Engagement mutation, syncing progress reports', {
      ...event,
      event: event.constructor.name,
    });

    const engagements =
      event instanceof ProjectUpdatedEvent
        ? await this.engagements.listAllByProjectId(event.updated.id)
        : event instanceof EngagementUpdatedEvent
        ? [event.updated]
        : [event.engagement];

    for (const engagement of engagements) {
      const [updated, prev] =
        event instanceof ProjectUpdatedEvent
          ? this.intervalsFromProjectChange(engagement, event)
          : event instanceof EngagementCreatedEvent
          ? [engagementRange(event.engagement), null]
          : [engagementRange(event.updated), engagementRange(event.previous)];

      const diff = this.diffBy(updated, prev, 'quarter');

      await this.sync(
        engagement.id,
        ReportType.Progress,
        diff,
        engagement.endDate?.endOf('quarter'),
      );
    }
  }

  private intervalsFromProjectChange(
    engagement: UnsecuredDto<Engagement>,
    event: ProjectUpdatedEvent,
  ): Intervals {
    return [
      // Engagement already has all the updated values calculated correctly.
      engagementRange(engagement),
      // For previous, there's no change if there was an override,
      // otherwise it's the project's previous
      DateInterval.tryFrom(
        engagement.startDateOverride ?? event.previous.mouStart,
        engagement.endDateOverride ?? event.previous.mouEnd,
      ),
    ];
  }
}
