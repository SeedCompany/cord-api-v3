import { DateTimeUnit } from 'luxon';
import { DateInterval, UnsecuredDto } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Project, projectRange } from '../../project';
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

    await this.syncNarrative(event);
    await this.syncFinancial(event);
  }

  private async syncFinancial(event: SubscribedEvent) {
    const diff = this.diffFinancial(event);
    if (!diff) {
      return;
    }
    const project = event.updated;

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
        project.mouEnd.endOf(diff.interval),
        event.session
      );
    }
  }

  private async syncNarrative(event: SubscribedEvent) {
    const diff = this.diffBy(event, 'quarter');
    await this.periodicReports.delete(
      event.updated.id,
      ReportType.Narrative,
      diff.removals
    );

    await Promise.all(
      diff.additions.map((interval) =>
        this.periodicReports.create(
          {
            start: interval.start,
            end: interval.end,
            type: ReportType.Narrative,
            projectOrEngagementId: event.updated.id,
          },
          event.session
        )
      )
    );

    if (event.updated.mouEnd) {
      await this.periodicReports.mergeFinalReport(
        event.updated.id,
        ReportType.Narrative,
        event.updated.mouEnd.endOf('quarter'),
        event.session
      );
    }
  }

  private diffFinancial(event: ProjectUpdatedEvent) {
    const project = event.updated;
    const previous = event.previous;

    if (!project.financialReportPeriod) return null;

    const newInterval: DateTimeUnit =
      project.financialReportPeriod === ReportPeriod.Monthly
        ? 'month'
        : 'quarter';

    if (project.financialReportPeriod === previous.financialReportPeriod) {
      const diff = this.diffBy(event, newInterval);
      return { interval: newInterval, ...diff };
    }

    const reportRanges = (proj: UnsecuredDto<Project>, unit: DateTimeUnit) =>
      projectRange(proj)
        ?.expandToFull(unit)
        .splitBy({ [unit]: 1 }) || [];

    const prevInterval: DateTimeUnit =
      previous.financialReportPeriod === ReportPeriod.Monthly
        ? 'month'
        : 'quarter';
    return {
      interval: newInterval,
      additions: reportRanges(project, newInterval),
      removals: reportRanges(previous, prevInterval),
    };
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
