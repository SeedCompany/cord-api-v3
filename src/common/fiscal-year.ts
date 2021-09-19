import { range } from 'lodash';
import { DateTime } from 'luxon';

export const fiscalYear = (dt: DateTime) =>
  dt.month >= 10 ? dt.year + 1 : dt.year;

export const fiscalYears = (start?: DateTime, end?: DateTime) =>
  start && end ? range(fiscalYear(start), fiscalYear(end) + 1) : [];

export const fiscalQuarter = (dt: DateTime) => {
  const fiscalMonth = dt.plus({ months: 3 }).month;
  return Math.floor((fiscalMonth + 2) / 3);
};
