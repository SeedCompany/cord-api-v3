import { DateTimeUnit } from 'luxon';
import { DateInterval } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { projectRange } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { ReportPeriod, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';
import {
  AbstractPeriodicReportSync,
  Intervals,
} from './abstract-periodic-report-sync';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportsToProjectDateRange
  extends AbstractPeriodicReportSync
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    periodicReports: PeriodicReportService,
    @Logger('periodic-reports:project-sync') private readonly logger: ILogger
  ) {
    super(periodicReports);
  }

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const project = event.updated;
    const intervals: Intervals = [
      projectRange(project),
      projectRange(event.previous),
    ];

    const narrativeDiff = this.diffBy(...intervals, 'quarter');
    await this.sync(
      event.session,
      project.id,
      ReportType.Narrative,
      narrativeDiff,
      project.mouEnd?.endOf('quarter')
    );

    if (!project.financialReportPeriod) {
      return;
    }
    const financialDiff = this.diffFinancial(intervals, event);
    await this.sync(
      event.session,
      project.id,
      ReportType.Financial,
      financialDiff,
      project.mouEnd?.endOf(financialDiff.interval)
    );
  }

  private diffFinancial(intervals: Intervals, event: ProjectUpdatedEvent) {
    const { updated, previous } = event;

    const newInterval: DateTimeUnit =
      updated.financialReportPeriod === ReportPeriod.Monthly
        ? 'month'
        : 'quarter';

    if (updated.financialReportPeriod === previous.financialReportPeriod) {
      const diff = this.diffBy(...intervals, newInterval);
      return { interval: newInterval, ...diff };
    }

    const projectMou = intervals[0]?.expandToFull(newInterval) ?? null;

    const reportRanges = (range: DateInterval | null, unit: DateTimeUnit) =>
      range?.expandToFull(unit).splitBy({ [unit]: 1 }) ?? [];

    const prevInterval = newInterval !== 'month' ? 'month' : 'quarter';
    return {
      interval: newInterval,
      additions: reportRanges(projectMou, newInterval),
      removals: [
        ...reportRanges(projectRange(previous), prevInterval),
        // If we have a complete date range also remove reports outside it.
        // Since there could be a previous date change that wasn't accounted for
        // due to the financial report period constraint not being met at the time.
        ...(projectMou
          ? [
              { start: null, end: projectMou.start },
              { start: projectMou.end, end: null },
            ]
          : []),
      ],
    };
  }
}
