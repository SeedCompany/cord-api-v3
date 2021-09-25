import { DateTimeUnit } from 'luxon';
import { DateInterval } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { projectRange } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportPeriod, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportsToProjectDateRange
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly periodicReports: PeriodicReportService,
    @Logger('periodic-reports:project-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    await this.syncFinancial(event);
  }

  private async syncFinancial(event: SubscribedEvent) {
    const project = event.updated;
    const previous = event.previous;

    if (!project.financialReportPeriod) return;

    const previousIntervalUnit =
      previous.financialReportPeriod === ReportPeriod.Monthly
        ? 'month'
        : 'quarter';
    const projectIntervalUnit =
      project.financialReportPeriod === ReportPeriod.Monthly
        ? 'month'
        : 'quarter';

    const diff =
      project.financialReportPeriod !== previous.financialReportPeriod
        ? {
            additions:
              projectRange(project)
                ?.expandToFull(projectIntervalUnit)
                .splitBy({
                  [projectIntervalUnit]: 1,
                }) || [],
            removals:
              projectRange(previous)
                ?.expandToFull(previousIntervalUnit)
                .splitBy({
                  [previousIntervalUnit]: 1,
                }) || [],
          }
        : this.diffBy(
            event,
            project.financialReportPeriod === ReportPeriod.Monthly
              ? 'month'
              : 'quarter'
          );

    await this.periodicReports.delete(
      project.id,
      ReportType.Financial,
      diff.removals
    );

    await Promise.all(
      diff.additions.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Financial,
            projectOrEngagementId: project.id,
          },
          event.session
        )
      )
    );

    if (project.mouEnd) {
      await this.periodicReports.mergeFinalReport(
        project.id,
        ReportType.Financial,
        project.mouEnd.endOf(projectIntervalUnit),
        event.session
      );
    }
  }

  private diffBy(event: SubscribedEvent, unit: DateTimeUnit) {
    const diff = DateInterval.compare(
      projectRange(event.previous)?.expandToFull(unit),
      projectRange(event.updated)?.expandToFull(unit)
    );
    const splitByUnit = (range: DateInterval) => range.splitBy({ [unit]: 1 });
    return {
      additions: diff.additions.flatMap(splitByUnit),
      removals: diff.removals.flatMap(splitByUnit),
    };
  }
}
