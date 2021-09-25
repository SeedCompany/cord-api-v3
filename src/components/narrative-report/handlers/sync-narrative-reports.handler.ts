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
import { NarrativeReportService } from '../narrative-report.service';

type SubscribedEvent =
  | EngagementCreatedEvent
  | EngagementUpdatedEvent
  | ProjectUpdatedEvent;

@EventsHandler(
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
  ProjectUpdatedEvent
)
export class SyncNarrativeReports implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly reports: NarrativeReportService,
    private readonly engagements: EngagementService,
    @Logger('narrative-report:engagement-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Syncing narrative reports', {
      ...event,
      event: event.constructor.name,
    });

    const diff = this.diff(event);

    if (event instanceof ProjectUpdatedEvent) {
      const projectEngagements = await this.getProjectEngagements(event);

      for (const engagement of projectEngagements) {
        await this.reports.delete(engagement.id, diff.removals);
        await this.createReports(engagement.id, diff.additions, event.session);
        await this.mergeFinalReport(engagement, event.session);
      }
    } else {
      const engagement =
        event instanceof EngagementUpdatedEvent
          ? event.updated
          : event.engagement;
      await this.reports.delete(engagement.id, diff.removals);
      await this.createReports(engagement.id, diff.additions, event.session);
      await this.mergeFinalReport(engagement, event.session);
    }
  }

  private async createReports(
    engagementId: ID,
    range: Interval[],
    session: Session
  ) {
    await Promise.all(
      range.map((interval) =>
        this.reports.create(engagementId, interval, session)
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

  private async mergeFinalReport(engagement: IEngagement, session: Session) {
    const dateRange = engagementRange(engagement);
    if (dateRange) {
      await this.reports.mergeFinalReport(
        engagement.id,
        dateRange.end.endOf('quarter'),
        session
      );
    }
  }
}
