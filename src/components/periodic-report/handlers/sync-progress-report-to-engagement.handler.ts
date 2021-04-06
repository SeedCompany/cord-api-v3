import { Interval } from 'luxon';
import {
  fiscalQuarters,
  getIntervalsDifference,
  Session,
} from '../../../common';
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

    const [startDate, endDate] = this.determineEngagementDateRange(
      event instanceof EngagementCreatedEvent ? event.engagement : event.updated
    );

    if (event instanceof EngagementCreatedEvent) {
      const quarterIntervals = fiscalQuarters(startDate, endDate);
      await this.addRecords(event.engagement, quarterIntervals, event.session);
    } else {
      const engagement = event.updated;
      const previous = event.previous;

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
        const [newQuarters, oldQuarters] = this.getNewPeriodIntervals(
          engagement,
          previous
        );
        await this.periodicReports.removeProgressReports(
          engagement,
          oldQuarters,
          event.session
        );
        await this.addRecords(engagement, newQuarters, event.session);
      }
    }
  }

  private async addRecords(
    engagement: Engagement,
    intervals: Interval[],
    session: Session
  ) {
    const reports = intervals.map((interval) =>
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

  private getNewPeriodIntervals(engagement: Engagement, previous: Engagement) {
    const [startDate, endDate] = this.determineEngagementDateRange(engagement);
    const [prevStartDate, prevEndDate] = this.determineEngagementDateRange(
      previous
    );

    const quarterIntervals = fiscalQuarters(startDate, endDate);
    const prevQuarterIntervals = fiscalQuarters(prevStartDate, prevEndDate);

    const newQuarters = getIntervalsDifference(
      quarterIntervals,
      prevQuarterIntervals
    );

    const oldQuarters = getIntervalsDifference(
      prevQuarterIntervals,
      quarterIntervals
    );

    return [newQuarters, oldQuarters];
  }
}
