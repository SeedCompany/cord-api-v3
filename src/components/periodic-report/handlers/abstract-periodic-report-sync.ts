import { type DateTimeUnit } from 'luxon';
import { type CalendarDate, DateInterval, type ID, type Range } from '~/common';
import { type ReportType } from '../dto';
import { type PeriodicReportService } from '../periodic-report.service';

export type Intervals = [
  updated: DateInterval | null,
  previous: DateInterval | null,
];

export abstract class AbstractPeriodicReportSync {
  constructor(protected readonly periodicReports: PeriodicReportService) {}

  protected async sync(
    parent: ID,
    type: ReportType,
    diff: {
      additions: ReadonlyArray<Range<CalendarDate>>;
      removals: ReadonlyArray<Range<CalendarDate | null>>;
    },
    finalAt?: CalendarDate,
  ) {
    await this.periodicReports.delete(parent, type, diff.removals);

    await this.periodicReports.merge({
      type,
      parent,
      intervals: diff.additions,
    });

    if (!finalAt) {
      return;
    }
    await this.periodicReports.mergeFinalReport(parent, type, finalAt);
  }

  /**
   * Diff ranges returning additions/removals by date time unit
   */
  protected diffBy(
    updated: DateInterval | null | undefined,
    previous: DateInterval | null | undefined,
    unit: DateTimeUnit,
  ) {
    const fullUpdated = updated?.expandToFull(unit);
    const diff = DateInterval.compare(
      previous?.expandToFull(unit),
      fullUpdated,
    );
    const splitByUnit = (range: DateInterval) => range.splitBy({ [unit]: 1 });
    return {
      additions: diff.additions.flatMap(splitByUnit),
      removals: [
        ...diff.removals.flatMap(splitByUnit),
        ...this.invertedRange(fullUpdated),
      ],
    };
  }

  /**
   * Return two partial ranges representing the inverse of the given range.
   *
   * Why:
   * If we have a complete date range there shouldn't be reports outside it
   * (unless delete excludes for reasons like having a file).
   * There could be a previous sync that missed some removals due to whatever
   * reasons, so this is a sanity check.
   */
  protected invertedRange(range: DateInterval | null | undefined) {
    return range
      ? [
          { start: null, end: range.start },
          { start: range.end, end: null },
        ]
      : [];
  }
}
