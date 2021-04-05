import {
  greaterEqualTo,
  isNull,
  lessEqualTo,
  node,
  relation,
} from 'cypher-query-builder';
import { fiscalQuarters, Session } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { Engagement } from '../../engagement';
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
    private readonly db: DatabaseService,
    private readonly periodicReports: PeriodicReportService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Engagement mutation, syncing progress reports', {
      ...event,
      event: event.constructor.name,
    });

    if (event instanceof EngagementCreatedEvent) {
      await this.addRecords(event.engagement, event.session);
    } else {
      const engagement = event.updated;
      const previous = event.previous;

      const [startDate, endDate] = this.determineEngagementDateRange(
        engagement
      );
      const [
        previousStartDate,
        previousEndDate,
      ] = this.determineEngagementDateRange(previous);

      const isDateRangeChanged =
        startDate &&
        endDate &&
        (startDate.toMillis() !== previousStartDate?.toMillis() ||
          endDate.toMillis() !== previousEndDate?.toMillis());

      if (isDateRangeChanged) {
        await this.removeOldReports(previous, event.session);
        await this.addRecords(engagement, event.session);
      }
    }
  }

  private async removeOldReports(engagement: Engagement, session: Session) {
    const [oldStart, oldEnd] = this.determineEngagementDateRange(engagement);
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
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'end', { active: true }),
        node('end', 'Property'),
      ])
      .with('report, rel, start, end')
      .where({
        rel: isNull(),
        'date(start.value)': greaterEqualTo(oldStart?.startOf('quarter')),
        'date(end.value)': lessEqualTo(oldEnd?.endOf('quarter')),
      })
      .return('report.id as reportId')
      .asResult<{ reportId: string }>()
      .run();

    await Promise.all(
      reports.map((report) =>
        this.periodicReports.delete(report.reportId, session)
      )
    );
  }

  private async addRecords(engagement: Engagement, session: Session) {
    const [startDate, endDate] = this.determineEngagementDateRange(engagement);
    const quarterIntervals = fiscalQuarters(startDate!, endDate!);

    const reports = quarterIntervals.map((interval) =>
      this.periodicReports.create(
        {
          start: interval.start,
          end: interval.start.endOf('quarter'),
          type: ReportType.Progress,
          projectOrEngagementId: engagement.id,
        },
        session
      )
    );

    await Promise.all(reports);
  }

  private determineEngagementDateRange(engagement: Engagement) {
    const startDate = engagement.startDateOverride.value
      ? engagement.startDateOverride.value
      : engagement.startDate.value;

    const endDate = engagement.endDateOverride.value
      ? engagement.endDateOverride.value
      : engagement.endDate.value;

    return [startDate, endDate];
  }
}
