import { DateTime } from 'luxon';
import {
  endOfFiscalYear,
  expandToFullFiscalYears,
  fiscalQuarter,
  fiscalYear,
  fiscalYears,
  fullFiscalQuarter,
  fullFiscalYear,
  startOfFiscalYear,
} from './fiscal-year';
import { DateInterval } from './temporal';

const feb2019 = DateTime.fromObject({ year: 2019, month: 2, day: 1 });
const sep302019 = DateTime.fromObject({ year: 2019, month: 9, day: 30 });
const oct2019 = DateTime.fromObject({ year: 2019, month: 10, day: 1 });
const nov2019 = DateTime.fromObject({ year: 2019, month: 11, day: 1 });
const dec2019 = DateTime.fromObject({ year: 2019, month: 12, day: 1 });
const dec312019 = DateTime.fromObject({ year: 2019, month: 12, day: 31 });
const jan2020 = DateTime.fromObject({ year: 2020, month: 1, day: 1 });
const mar312020 = DateTime.fromObject({ year: 2020, month: 3, day: 31 });
const jun2020 = DateTime.fromObject({ year: 2020, month: 6, day: 1 });
const sep2020 = DateTime.fromObject({ year: 2020, month: 9, day: 1 });
const sep302020 = DateTime.fromObject({ year: 2020, month: 9, day: 30 });
const oct2020 = DateTime.fromObject({ year: 2020, month: 10, day: 1 });
const dec312020 = DateTime.fromObject({ year: 2020, month: 12, day: 31 });
const sep302021 = DateTime.fromObject({ year: 2021, month: 9, day: 30 });
const fy2020 = DateInterval.fromObject({
  start: oct2019,
  end: sep302020,
});
const fy2021 = DateInterval.fromObject({
  start: oct2020,
  end: sep302021,
});
const qtrFour2019 = DateInterval.fromObject({
  start: oct2019,
  end: dec312019,
});
const qtrOne2020 = DateInterval.fromObject({
  start: jan2020,
  end: mar312020,
});
const qtrFour2020 = DateInterval.fromObject({
  start: oct2020,
  end: dec312020,
});
const jun2020ToEOY = DateInterval.fromObject({
  start: jun2020,
  end: dec312020,
});
const fiscalYrs20and21 = DateInterval.fromObject({
  start: oct2019,
  end: sep302021,
});

describe('fiscalYear', () => {
  it.each([
    [oct2019, 2020],
    [nov2019, 2020],
    [dec2019, 2020],
    [jan2020, 2020],
    [jun2020, 2020],
  ])('%o -> %o', (fYear, cYear) => {
    expect(fiscalYear(fYear)).toEqual(cYear);
  });
});

describe('fiscalYears', () => {
  it.each([
    [oct2019, sep2020, [2020]],
    [oct2019, oct2020, [2020, 2021]],
    [oct2019, undefined, []],
    [undefined, oct2020, []],
    [feb2019, oct2020, [2019, 2020, 2021]],
    [jun2020, feb2019, []],
  ])('%o %o -> %o', (cStart, cEnd, expectedRange) => {
    expect(fiscalYears(cStart, cEnd)).toEqual(expectedRange);
  });
});

describe('fiscalQuarter', () => {
  it.each([
    [oct2019, 1],
    [nov2019, 1],
    [dec2019, 1],
    [jan2020, 2],
    [jun2020, 3],
    [sep2020, 4],
  ])('%o -> %o', (cDate, expQtr) => {
    expect(fiscalQuarter(cDate)).toEqual(expQtr);
  });
});

describe('startOfFiscalYear', () => {
  it.each([
    [oct2019, oct2019],
    [nov2019, oct2019],
    [dec2019, oct2019],
    [jan2020, oct2019],
    [sep2020, oct2019],
    [oct2020, oct2020],
  ])('%o -> %o', (cDate, expYear) => {
    expect(startOfFiscalYear(cDate)).toEqual(expYear);
  });
});

describe('endOfFiscalYear', () => {
  it.each([
    [feb2019, sep302019],
    [oct2019, sep302020],
    [nov2019, sep302020],
    [dec2019, sep302020],
    [jan2020, sep302020],
    [oct2020, sep302021],
  ])('%o -> %o', (cDate, expYear) => {
    expect(endOfFiscalYear(cDate)).toEqual(expYear);
  });
});

describe('expandToFullFiscalYears', () => {
  it.each([
    [fy2020, fy2020],
    [fy2021, fy2021],
    [qtrFour2019, fy2020],
    [qtrOne2020, fy2020],
    [qtrFour2020, fy2021],
    [jun2020ToEOY, fiscalYrs20and21],
  ])('%o -> %o', (dateInt, expYears) => {
    expect(expandToFullFiscalYears(dateInt)).toEqual(expYears);
  });
});

describe('fullFiscalYear', () => {
  it.each([
    [2020, fy2020],
    [2021, fy2021],
  ])('%o -> %o', (yrNum, fYearInterval) => {
    expect(fullFiscalYear(yrNum)).toEqual(fYearInterval);
  });
});
describe('fullFiscalQuarter', () => {
  it.each([
    [1, 2020, '2019-10-01/2019-12-31'],
    [2, 2020, '2020-01-01/2020-03-31'],
    [3, 2020, '2020-04-01/2020-06-30'],
    [4, 2020, '2020-07-01/2020-09-30'],
  ])('%o %o -> %o', (fiscalQuarter, fiscalYear, dateRange) => {
    expect(fullFiscalQuarter(fiscalQuarter, fiscalYear).toISO()).toEqual(
      dateRange
    );
  });
});
