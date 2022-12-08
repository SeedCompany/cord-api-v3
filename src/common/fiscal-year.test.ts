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

const feb2019 = DateTime.local(2019, 2, 1);
const sep302019 = DateTime.local(2019, 9, 30);
const oct2019 = DateTime.local(2019, 10, 1);
const nov2019 = DateTime.local(2019, 11, 1);
const dec2019 = DateTime.local(2019, 12, 1);
const dec312019 = DateTime.local(2019, 12, 31);
const jan2020 = DateTime.local(2020, 1, 1);
const mar312020 = DateTime.local(2020, 3, 31);
const apr2020 = DateTime.local(2020, 4, 1);
const jun2020 = DateTime.local(2020, 6, 1);
const jun302020 = DateTime.local(2020, 6, 30);
const jul2020 = DateTime.local(2020, 7, 1);
const sep2020 = DateTime.local(2020, 9, 1);
const sep302020 = DateTime.local(2020, 9, 30);
const oct2020 = DateTime.local(2020, 10, 1);
const dec312020 = DateTime.local(2020, 12, 31);
const sep302021 = DateTime.local(2021, 9, 30);
const fy2020 = DateInterval.fromDateTimes(oct2019, sep302020);
const fy2021 = DateInterval.fromDateTimes(oct2020, sep302021);
const qtrFour2019 = DateInterval.fromDateTimes(oct2019, dec312019);
const qtrOne2020 = DateInterval.fromDateTimes(jan2020, mar312020);
const qtrTwo2020 = DateInterval.fromDateTimes(apr2020, jun302020);
const qtrThree2020 = DateInterval.fromDateTimes(jul2020, sep302020);
const qtrFour2020 = DateInterval.fromDateTimes(oct2020, dec312020);
const jun2020ToEOY = DateInterval.fromDateTimes(jun2020, dec312020);
const fiscalYrs20and21 = DateInterval.fromDateTimes(oct2019, sep302021);

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
    [1, 2020, qtrFour2019],
    [2, 2020, qtrOne2020],
    [3, 2020, qtrTwo2020],
    [4, 2020, qtrThree2020],
  ])('%o %o -> %o', (fiscalQuarter, fiscalYear, dateRange) => {
    expect(fullFiscalQuarter(fiscalQuarter, fiscalYear)).toEqual(dateRange);
  });
});
