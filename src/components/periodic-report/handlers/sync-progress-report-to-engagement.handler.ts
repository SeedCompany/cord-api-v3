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
import { AbstractPeriodicReportSync } from './abstract-periodic-report-sync';

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

    const [prev, updated] =
      event instanceof ProjectUpdatedEvent
        ? [projectRange(event.previous), projectRange(event.updated)]
        : event instanceof EngagementCreatedEvent
        ? [null, engagementRange(event.engagement)]
        : [engagementRange(event.previous), engagementRange(event.updated)];

    const diff = this.diffBy(updated, prev, 'quarter');

    const engagements =
      event instanceof ProjectUpdatedEvent
        ? await this.getProjectEngagements(event)
        : event instanceof EngagementUpdatedEvent
        ? [event.updated]
        : [event.engagement];

    for (const engagement of engagements) {
      await this.sync(
        event.session,
        engagement.id,
        ReportType.Progress,
        diff,
        engagement.endDate.value?.endOf('quarter')
      );
    }
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
