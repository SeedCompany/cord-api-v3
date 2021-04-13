import { DurationUnit } from 'luxon';
import { DateInterval } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { projectRange } from '../../project';
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

    await this.syncNarrative(event);
    await this.syncFinancial(event);
  }

  private async syncFinancial(event: SubscribedEvent) {
    const project = event.updated;
    const diff = this.diffBy(
      event,
      project.financialReportPeriod === ReportPeriod.Monthly
        ? 'months'
        : 'quarters'
    );

    await this.periodicReports.removeFinancialReports(
      project.id,
      diff.removals,
      event.session
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
  }

  private async syncNarrative(event: SubscribedEvent) {
    const diff = this.diffBy(event, 'quarter');
    await this.periodicReports.removeNarrativeReports(
      event.updated.id,
      diff.removals,
      event.session
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
  }

  private diffBy(event: SubscribedEvent, unit: DurationUnit) {
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
