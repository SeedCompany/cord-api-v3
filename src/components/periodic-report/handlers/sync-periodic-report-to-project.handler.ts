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
      await this.periodicReports.removeFinancialReports(project, event.session);
      await this.periodicReports.removeNarrativeReports(project, event.session);
      await this.addRecords(project, event.session);
    }
  }

  private async addRecords(project: Project, session: Session) {
    const startDate = project.mouStart.value!;
    const endDate = project.mouEnd.value!;

    const quarterIntervals = fiscalQuarters(startDate, endDate);
    const monthIntervals = fiscalMonths(startDate, endDate);

    let financialReportPromises: Array<Promise<any>> = [];
    if (project.financialReportPeriod.value === ReportPeriod.Monthly) {
      financialReportPromises = monthIntervals.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.start.endOf('month'),
            type: ReportType.Financial,
            projectOrEngagementId: project.id,
          },
          session
        )
      );
    } else {
      financialReportPromises = quarterIntervals.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.start.endOf('quarter'),
            type: ReportType.Financial,
            projectOrEngagementId: project.id,
          },
          session
        )
      );
    }

    const narrativeReportPromises = quarterIntervals.map((interval) =>
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
