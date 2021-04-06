import { differenceBy } from 'lodash';
import { Interval } from 'luxon';
import { fiscalMonths, fiscalQuarters, Session } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Project } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportPeriod, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportsToProjectDateRange
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly periodicReports: PeriodicReportService,
    @Logger('periodic-reports:project-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const project = event.updated;
    const previous = event.previous;

    // Check if the project has valid date range set and changed from the previous set
    const isDateRangeChanged =
      project.mouStart.value &&
      project.mouEnd.value &&
      (project.mouStart.value.toMillis() !==
        previous.mouStart.value?.toMillis() ||
        project.mouEnd.value.toMillis() !== previous.mouEnd.value?.toMillis());

    if (isDateRangeChanged) {
      const [
        newQuarters,
        newMonths,
        oldQuarters,
        oldMonths,
      ] = this.getNewPeriodIntervals(project, previous);
      await this.removeRecords(project, oldQuarters, oldMonths, event.session);
      await this.addRecords(project, newQuarters, newMonths, event.session);
    }
  }

  private getNewPeriodIntervals(project: Project, previous: Project) {
    const startDate = project.mouStart.value;
    const endDate = project.mouEnd.value;
    const prevStartDate = previous.mouStart.value;
    const prevEndDate = previous.mouEnd.value;

    const quarterIntervals = fiscalQuarters(startDate, endDate);
    const monthIntervals = fiscalMonths(startDate, endDate);
    const prevQuarterIntervals = fiscalQuarters(prevStartDate, prevEndDate);
    const prevMonthIntervals = fiscalMonths(prevStartDate, prevEndDate);

    const newQuarters = differenceBy(
      quarterIntervals,
      prevQuarterIntervals,
      (interval) => interval.start.toMillis()
    );
    const newMonths = differenceBy(
      monthIntervals,
      prevMonthIntervals,
      (interval) => interval.start.toMillis()
    );

    const oldQuarters = differenceBy(
      prevQuarterIntervals,
      quarterIntervals,
      (interval) => interval.start.toMillis()
    );
    const oldMonths = differenceBy(
      prevMonthIntervals,
      monthIntervals,
      (interval) => interval.start.toMillis()
    );

    return [newQuarters, newMonths, oldQuarters, oldMonths];
  }

  private async removeRecords(
    project: Project,
    quarters: Interval[],
    months: Interval[],
    session: Session
  ) {
    await this.periodicReports.removeFinancialReports(
      project,
      project.financialReportPeriod.value === ReportPeriod.Monthly
        ? months
        : quarters,
      session
    );
    await this.periodicReports.removeNarrativeReports(
      project,
      quarters,
      session
    );
  }

  private async addRecords(
    project: Project,
    quarters: Interval[],
    months: Interval[],
    session: Session
  ) {
    const isMonthlyFinancialReport =
      project.financialReportPeriod.value === ReportPeriod.Monthly;
    const financialReportPeriod = isMonthlyFinancialReport
      ? 'month'
      : 'quarter';

    const financialReportPromises = (isMonthlyFinancialReport
      ? months
      : quarters
    ).map((interval) =>
      this.periodicReports.create(
        {
          start: interval.start,
          end: interval.start.endOf(financialReportPeriod),
          type: ReportType.Financial,
          projectOrEngagementId: project.id,
        },
        session
      )
    );

    const narrativeReportPromises = quarters.map((interval) =>
      this.periodicReports.create(
        {
          start: interval.start,
          end: interval.start.endOf('quarter'),
          type: ReportType.Narrative,
          projectOrEngagementId: project.id,
        },
        session
      )
    );

    await Promise.all([...financialReportPromises, ...narrativeReportPromises]);
  }
}
