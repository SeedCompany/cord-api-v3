import { range } from 'lodash';
import { DateTime } from 'luxon';
import { CalendarDate, DateInterval } from './temporal';

export const fiscalQuarterLabel = (date: CalendarDate) =>
  `Q${fiscalQuarter(date)} FY${fiscalYear(date)}`;

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
    endOfFiscalYear(dates.end),
  );

export const fullFiscalYear = (fiscalYear: number) =>
  DateInterval.fromDateTimes(
    CalendarDate.local(fiscalYear - 1, 10, 1),
    CalendarDate.local(fiscalYear, 9, 30),
  );

/** The date interval of a given fiscal quarter */
export const fullFiscalQuarter = (
  fiscalQuarter: number,
  fiscalYear: number,
) => {
  const year = fiscalYear + (fiscalQuarter === 1 ? -1 : 0);
  const quarter = fiscalQuarter + (fiscalQuarter === 1 ? 2 : -2);
  const fiscalQuarterStartDate = CalendarDate.local(year, 1, 1).plus({
    quarter,
  });

  return DateInterval.fromDateTimes(
    fiscalQuarterStartDate,
    fiscalQuarterStartDate.endOf('quarter'),
  );
};

export const isReasonableYear = (year: unknown) =>
  isInt(year) && year >= 1970 && year <= 3000;

export const isQuarterNumber = (quarter: unknown) =>
  isInt(quarter) && quarter >= 1 && quarter <= 4;

// Not true for falsy case, thus not built-in, but fine for our cases here.
const isInt = (x: unknown): x is number => Number.isInteger(x);
