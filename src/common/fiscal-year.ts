import { range } from 'lodash';
import { DateTime, Interval } from 'luxon';

export const fiscalYear = (dt: DateTime) =>
  dt.month >= 10 ? dt.year + 1 : dt.year;

export const fiscalYears = (start?: DateTime, end?: DateTime) =>
  start && end ? range(fiscalYear(start), fiscalYear(end) + 1) : [];

export const fiscalQuarters = (
  start?: DateTime,
  end?: DateTime
): Interval[] => {
  if (!start || !end) {
    return [];
  }

  const quartersStartDate = start.startOf('quarter');
  const quartersEndDate = end.endOf('quarter');

  const intervals = Interval.fromDateTimes(
    quartersStartDate,
    quartersEndDate
  ).splitBy({ quarter: 1 });

  return intervals; // Luxon quarterly interval format: 01/01/2021 ~ 01/04/2021
};

export const fiscalMonths = (start?: DateTime, end?: DateTime): Interval[] => {
  if (!start || !end) {
    return [];
  }

  const monthsStartDate = start.startOf('month');
  const monthsEndDate = end.endOf('month');

  const intervals = Interval.fromDateTimes(
    monthsStartDate,
    monthsEndDate
  ).splitBy({ months: 1 });

  return intervals; // Luxon monthly interval format: 01/01/2021 ~ 01/02/2021
};
