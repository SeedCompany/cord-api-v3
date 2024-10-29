import { DateTimeUnit } from 'luxon';
import { DateInterval } from '~/common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '~/core';
import { projectRange } from '../../project/dto';
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
    @Logger('periodic-reports:project-sync') private readonly logger: ILogger,
  ) {
    super(periodicReports);
  }

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const project = event.updated;

    const isActive = event.updated.status === 'Active';
    const wasActive = event.previous.status === 'Active';

    const intervals: Intervals = [
      isActive ? projectRange(project) : null,
      wasActive ? projectRange(event.previous) : null,
    ];
    const finalReportAt = isActive ? project.mouEnd : null;

    const narrativeDiff = this.diffBy(...intervals, 'quarter');
    await this.sync(
      event.session,
      project.id,
      ReportType.Narrative,
      narrativeDiff,
      finalReportAt?.endOf('quarter'),
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
      finalReportAt?.endOf(financialDiff.interval),
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
        ...this.invertedRange(projectMou),
      ],
    };
  }
}
