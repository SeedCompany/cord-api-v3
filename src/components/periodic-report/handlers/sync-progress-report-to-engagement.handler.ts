import { Interval } from 'luxon';
import { DateInterval, ID, Session } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import {
  engagementRange,
  EngagementService,
  IEngagement,
} from '../../engagement';
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

    await this.syncProgress(event);
  }

  private async syncProgress(event: SubscribedEvent) {
    const diff = this.diff(event);

    if (event instanceof ProjectUpdatedEvent) {
      const projectEngagements = await this.getProjectEngagements(event);

      for (const engagement of projectEngagements) {
        await this.deleteReports(engagement.id, diff.removals);
        await this.createReports(engagement.id, diff.additions, event.session);
        await this.createOrUpdateFinalReport(engagement, event.session);
      }
    } else {
      const engagement =
        event instanceof EngagementUpdatedEvent
          ? event.updated
          : event.engagement;
      await this.deleteReports(engagement.id, diff.removals);
      await this.createReports(engagement.id, diff.additions, event.session);
      await this.createOrUpdateFinalReport(engagement, event.session);
    }
  }

  private async deleteReports(engagementId: ID, range: Interval[]) {
    await this.periodicReports.delete(engagementId, ReportType.Progress, range);
  }

  private async createReports(
    engagementId: ID,
    range: Interval[],
    session: Session
  ) {
    await Promise.all(
      range.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Progress,
            projectOrEngagementId: engagementId,
          },
          session
        )
      )
    );
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
    const splitByUnit = (range: Interval) => range.splitBy({ quarter: 1 });
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

  private async createOrUpdateFinalReport(
    engagement: IEngagement,
    session: Session
  ) {
    const dateRange = engagementRange(engagement);
    if (dateRange) {
      await this.periodicReports.createOrUpdateFinalReportWithDateRange(
        engagement.id,
        ReportType.Progress,
        dateRange.end.endOf('quarter'),
        dateRange.end.endOf('quarter'),
        session
      );
    }
  }
}
