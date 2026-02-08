import { type DateTimeUnit } from 'luxon';
import { type DateInterval } from '~/common';
import { ILogger, Logger } from '~/core';
import { OnHook } from '~/core/hooks';
import { projectRange } from '../../project/dto';
import { ProjectUpdatedHook } from '../../project/hooks';
import { ReportPeriod, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';
import {
  AbstractPeriodicReportSync,
  type Intervals,
} from './abstract-periodic-report-sync';

type SubscribedEvent = ProjectUpdatedHook;

@OnHook(ProjectUpdatedHook)
export class SyncPeriodicReportsToProjectDateRange extends AbstractPeriodicReportSync {
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
    const intervals: Intervals = [
      projectRange(project),
      projectRange(event.previous),
    ];

    const narrativeDiff = this.diffBy(...intervals, 'quarter');
    await this.sync(
      project.id,
      ReportType.Narrative,
      narrativeDiff,
      project.mouEnd?.endOf('quarter'),
    );

    if (!project.financialReportPeriod) {
      return;
    }
    const financialDiff = this.diffFinancial(intervals, event);
    await this.sync(
      project.id,
      ReportType.Financial,
      financialDiff,
      project.mouEnd?.endOf(financialDiff.interval),
    );
  }

  private diffFinancial(intervals: Intervals, event: ProjectUpdatedHook) {
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
