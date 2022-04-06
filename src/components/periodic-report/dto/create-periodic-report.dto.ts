import { CalendarDate, ID, Range, Session } from '../../../common';
import { ReportType } from './report-type.enum';

export abstract class MergePeriodicReports {
  readonly parent: ID;
  readonly type: ReportType;
  readonly intervals: ReadonlyArray<Range<CalendarDate>>;
  readonly session: Session;
}