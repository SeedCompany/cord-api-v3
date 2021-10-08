import { range } from 'lodash';
import { DateTime } from 'luxon';
import { CalendarDate, DateInterval } from './temporal';

export const fiscalYear = (dt: DateTime) =>
  dt.month >= 10 ? dt.year + 1 : dt.year;

export const fiscalYears = (start?: DateTime, end?: DateTime) =>
  start && end ? range(fiscalYear(start), fiscalYear(end) + 1) : [];

export const fiscalQuarter = (dt: DateTime) =>
  dt.quarter === 4 ? 1 : dt.quarter + 1;

export const fullFiscalYear = (fiscalYear: number) =>
  DateInterval.fromDateTimes(
    CalendarDate.local(fiscalYear, 10, 1),
    CalendarDate.local(fiscalYear + 1, 9, 30)
  );
