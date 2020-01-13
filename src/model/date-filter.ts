import { DateTime } from 'luxon';

export interface DateFilter {
  dateRange?: 'createdAt' | 'updatedAt';
  startDate?: DateTime;
  endDate?: DateTime;
}

export interface DateFilterAPI {
  createdAt?: { gte?: DateTime; lte?: DateTime };
  updatedAt?: { gte?: DateTime; lte?: DateTime };
}

export const buildDateFilter = <Filters extends DateFilter>(
  filters: Filters,
): Omit<Filters, keyof DateFilter> & DateFilterAPI => {
  const { dateRange, startDate, endDate, ...rest } = filters;

  if (dateRange && (startDate || endDate)) {
    return {
      [dateRange]: {
        gte: startDate,
        lte: endDate,
      },
      ...rest,
    };
  }

  return rest;
};
