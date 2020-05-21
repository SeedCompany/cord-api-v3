import { range } from 'lodash';
import { DateTime } from 'luxon';

export const fiscalYear = (dt: DateTime) =>
  dt.month > 10 ? dt.year + 1 : dt.year;

export const fiscalYears = (start?: DateTime, end?: DateTime) =>
  start && end ? range(fiscalYear(start), fiscalYear(end) + 1) : [];
