import { isNull, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Session } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { Engagement } from '../../engagement';
import { EngagementUpdatedEvent } from '../../engagement/events';
import { CreatePeriodicReport } from '../dto';
import { ReportType } from '../dto/type.enum';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = EngagementUpdatedEvent;

@EventsHandler(EngagementUpdatedEvent)
export class SyncProgressReportToProject
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly periodicReports: PeriodicReportService,
    @Logger('periodicReport:sync-project') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const engagement = event.updated;
    const previous = event.previous;

    const [startDate, endDate] = this.determineEngagementDateRange(engagement);
    const [
      previousStartDate,
      previousEndDate,
    ] = this.determineEngagementDateRange(previous);

    const isDateRangeChanged =
      startDate !== previousStartDate || endDate !== previousEndDate;

    if (isDateRangeChanged) {
      await this.removeOldReports(engagement, event.session);
      await this.syncRecords(engagement, event.session);
    }
  }

  private async removeOldReports(engagement: Engagement, session: Session) {
    const reports = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagement.id }),
        relation('out', '', 'report', { active: true }),
        node('report', 'PeriodicReport'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', 'rel', 'reportFile', { active: true }),
        node('file', 'File'),
      ])
      .with('report, rel')
      .where({ rel: isNull() })
      .return('report.id as reportId')
      .asResult<{ reportId: string }>()
      .run();

    await Promise.all(
      reports.map((report) =>
        this.periodicReports.delete(report.reportId, session)
      )
    );
  }

  private async syncRecords(engagement: Engagement, session: Session) {
    const [startDate, endDate] = this.determineEngagementDateRange(engagement);

    await this.addReport(
      engagement.id,
      {
        start: startDate,
        end: endDate,
        type: ReportType.Progress,
      },
      session
    );
  }

  private async addReport(
    engagementId: string,
    input: CreatePeriodicReport,
    session: Session
  ) {
    const report = await this.periodicReports.create(input, session);
    await this.db
      .query()
      .match(node('engagement', 'Engagement', { id: engagementId }))
      .match(node('periodicReport', 'PeriodicReport', { id: report.id }))
      .create([
        node('engagement'),
        relation('out', '', 'report', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('periodicReport'),
      ])
      .run();
  }

  private determineEngagementDateRange(engagement: Engagement) {
    const startDate = engagement.startDateOverride.value
      ? engagement.startDateOverride.value
      : engagement.startDate.value!;

    const endDate = engagement.endDateOverride.value
      ? engagement.endDateOverride.value
      : engagement.endDate.value!;

    return [startDate, endDate];
  }
}
