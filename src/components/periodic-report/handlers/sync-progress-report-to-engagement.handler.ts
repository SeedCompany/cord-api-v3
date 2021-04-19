import { Interval } from 'luxon';
import { DateInterval } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Engagement, engagementRange } from '../../engagement';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class SyncProgressReportToEngagementDateRange
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly periodicReports: PeriodicReportService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, syncing progress reports', {
      ...event,
      event: event.constructor.name,
    });

    await this.syncProgress(event);
  }

  private async syncProgress(event: SubscribedEvent) {
    const [prev, updated] =
      event instanceof EngagementUpdatedEvent
        ? [event.previous, event.updated]
        : [null, event.engagement];

    const diff = this.diff(prev, updated);

    await this.periodicReports.removeProgressReports(
      updated.id,
      diff.removals,
      event.session
    );

    await Promise.all(
      diff.additions.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Progress,
            projectOrEngagementId: updated.id,
          },
          event.session
        )
      )
    );
  }

  private diff(prev: Engagement | null, updated: Engagement) {
    const diff = DateInterval.compare(
      prev ? engagementRange(prev)?.expandToFull('quarter') : null,
      engagementRange(updated)?.expandToFull('quarter')
    );
    const splitByUnit = (range: Interval) => range.splitBy({ quarter: 1 });
    return {
      additions: diff.additions.flatMap(splitByUnit),
      removals: diff.removals.flatMap(splitByUnit),
    };
  }
}
