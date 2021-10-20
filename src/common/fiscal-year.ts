import { range } from 'lodash';
import { DateTime } from 'luxon';
import { CalendarDate, DateInterval } from './temporal';

export const fiscalYear = (dt: DateTime) => dt.year + (dt.month >= 10 ? 1 : 0);

export const fiscalYears = (start?: DateTime, end?: DateTime) =>
  start && end ? range(fiscalYear(start), fiscalYear(end) + 1) : [];

export const fiscalQuarter = (dt: DateTime) =>
  dt.quarter === 4 ? 1 : dt.quarter + 1;

export const startOfFiscalYear = (date: CalendarDate) =>
  CalendarDate.local(date.year - (date.month >= 10 ? 0 : 1), 10, 1);

export const endOfFiscalYear = (date: CalendarDate) =>
  CalendarDate.local(date.year + (date.month >= 10 ? 1 : 0), 9, 30);

export const expandToFullFiscalYears = (dates: DateInterval) =>
  DateInterval.fromDateTimes(
    startOfFiscalYear(dates.start),
    endOfFiscalYear(dates.end)
  );

export const fullFiscalYear = (fiscalYear: number) =>
  DateInterval.fromDateTimes(
    CalendarDate.local(fiscalYear, 10, 1),
    CalendarDate.local(fiscalYear + 1, 9, 30)
  );
