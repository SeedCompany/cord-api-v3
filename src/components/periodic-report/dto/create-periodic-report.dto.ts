import { type CalendarDate, type ID, type Range, type Session } from '~/common';
import { type ReportType } from './report-type.enum';

export abstract class MergePeriodicReports {
  readonly parent: ID;
  readonly type: ReportType;
  readonly intervals: ReadonlyArray<Range<CalendarDate>>;
  readonly session: Session;
}
