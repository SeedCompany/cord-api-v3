import { Interval } from 'luxon';
import { DateInterval } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { engagementRange, EngagementService } from '../../engagement';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { projectRange } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

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
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly periodicReports: PeriodicReportService,
    private readonly engagements: EngagementService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger
  ) {}

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

    const diff = this.diff(event);

    const engagements =
      event instanceof ProjectUpdatedEvent
        ? await this.getProjectEngagements(event)
        : event instanceof EngagementUpdatedEvent
        ? [event.updated]
        : [event.engagement];

    for (const engagement of engagements) {
      await this.periodicReports.delete(
        engagement.id,
        ReportType.Progress,
        diff.removals
      );

      await this.periodicReports.merge({
        parent: engagement.id,
        type: ReportType.Progress,
        intervals: diff.additions,
        session: event.session,
      });

      if (engagement.endDate.value) {
        await this.periodicReports.mergeFinalReport(
          engagement.id,
          ReportType.Progress,
          engagement.endDate.value.endOf('quarter'),
          event.session
        );
      }
    }
  }

  private diff(event: SubscribedEvent) {
    let prevRange;
    let updatedRange;
    if (event instanceof ProjectUpdatedEvent) {
      prevRange = projectRange(event.previous);
      updatedRange = projectRange(event.updated);
    }
    if (event instanceof EngagementCreatedEvent) {
      prevRange = null;
      updatedRange = engagementRange(event.engagement);
    }
    if (event instanceof EngagementUpdatedEvent) {
      prevRange = engagementRange(event.previous);
      updatedRange = engagementRange(event.updated);
    }

    const diff = DateInterval.compare(
      prevRange?.expandToFull('quarter'),
      updatedRange?.expandToFull('quarter')
    );
    const splitByUnit = (range: Interval) => range.splitBy({ quarters: 1 });
    return {
      additions: diff.additions.flatMap(splitByUnit),
      removals: diff.removals.flatMap(splitByUnit),
    };
  }

  private async getProjectEngagements(event: ProjectUpdatedEvent) {
    const projectEngagements = await this.engagements.listAllByProjectId(
      event.updated.id,
      event.session
    );
    return projectEngagements.filter(
      (engagement) =>
        !engagement.startDateOverride.value || !engagement.endDateOverride.value
    );
  }
}
