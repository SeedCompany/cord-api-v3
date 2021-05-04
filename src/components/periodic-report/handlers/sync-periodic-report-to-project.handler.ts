import { forwardRef, Inject } from '@nestjs/common';
import { DurationUnit } from 'luxon';
import { DateInterval, Session } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { projectRange, ProjectService } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportPeriod, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportsToProjectDateRange
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly periodicReports: PeriodicReportService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService,
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

  private async syncOldProjects(session: Session) {
    const projects = await this.projects.listProjectsWithDateRange();
    await Promise.all(
      projects.flatMap((p) =>
        DateInterval.tryFrom(p.mouStart, p.mouEnd)
          .expandToFull('quarters')
          .difference()
          .flatMap((r) => r.splitBy({ quarters: 1 }))
          .flatMap((interval) => [
            this.periodicReports.create(
              {
                start: interval.start,
                end: interval.end,
                type: ReportType.Financial,
                projectOrEngagementId: p.projectId,
              },
              session
            ),
            this.periodicReports.create(
              {
                start: interval.start,
                end: interval.end,
                type: ReportType.Narrative,
                projectOrEngagementId: p.projectId,
              },
              session
            ),
          ])
      )
    );
  }
}
