import { CalendarDate, ID } from '../../../common';
import { ReportType } from './report-type.enum';

export abstract class CreatePeriodicReport {
  readonly projectOrEngagementId: ID;
  readonly type: ReportType;
  readonly start: CalendarDate;
  readonly end: CalendarDate;
  readonly skippedReason?: string;
}
