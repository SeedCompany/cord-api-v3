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

const Feb2019 = DateTime.fromObject({ year: 2019, month: 2, day: 1 });
const Oct2019 = DateTime.fromObject({ year: 2019, month: 10, day: 1 });
const Nov2019 = DateTime.fromObject({ year: 2019, month: 11, day: 1 });
const Dec2019 = DateTime.fromObject({ year: 2019, month: 12, day: 1 });
const Jan2020 = DateTime.fromObject({ year: 2020, month: 1, day: 1 });
const Jun2020 = DateTime.fromObject({ year: 2020, month: 6, day: 1 });
const Sep2020 = DateTime.fromObject({ year: 2020, month: 9, day: 1 });
const Oct2020 = DateTime.fromObject({ year: 2020, month: 10, day: 1 });
const Sep302019 = DateTime.fromObject({ year: 2019, month: 9, day: 30 });
const Sep302020 = DateTime.fromObject({ year: 2020, month: 9, day: 30 });
const Sep302021 = DateTime.fromObject({ year: 2021, month: 9, day: 30 });
const dInterval2020 = DateInterval.fromObject({
  start: Oct2019,
  end: Sep302020,
});
const dInterval2021 = DateInterval.fromObject({
  start: Oct2020,
  end: Sep302021,
});

describe('fiscal-year-example', () => {
  //TODO - This is an example as to what a single test case WOULD be like with a
  // standard 'it' statement.  However, due to the nature of this function it should also be
  // transformed into the case below using the 'it.each' to easily cover all cases
  it('should return current year when date is in second quarter', () => {
    const regularDate = Jun2020;

    expect(fiscalYear(regularDate)).toEqual(2020);
  });
});

describe('fiscalYear', () => {
  it.each([
    [Oct2019, 2020],
    [Nov2019, 2020],
    [Dec2019, 2020],
    [Jan2020, 2020],
    [Jun2020, 2020],
  ])('FY%s -> CY%s', (fYear, cYear) => {
    expect(fiscalYear(fYear)).toEqual(cYear);
  });
});

describe('fiscalYears', () => {
  it.each([
    [Oct2019, Sep2020, [2020]],
    [Oct2019, Oct2020, [2020, 2021]],
    [Oct2019, undefined, []],
    [undefined, Oct2020, []],
    [Feb2019, Oct2020, [2019, 2020, 2021]],
    [Jun2020, Feb2019, []],
  ])('CStart%s CEnd%s -> expectedRange%s', (cStart, cEnd, expectedRange) => {
    expect(fiscalYears(cStart, cEnd)).toEqual(expectedRange);
  });
});

describe('fiscalQuarter', () => {
  it.each([
    [Oct2019, 1],
    [Nov2019, 1],
    [Dec2019, 1],
    [Jan2020, 2],
    [Jun2020, 3],
    [Sep2020, 4],
  ])('CalDate%s -> FiscalQtr%s', (cDate, expQtr) => {
    expect(fiscalQuarter(cDate)).toEqual(expQtr);
  });
});

describe('startOfFiscalYear', () => {
  it.each([
    [Oct2019, Oct2019],
    [Nov2019, Oct2019],
    [Dec2019, Oct2019],
    [Jan2020, Oct2019],
    [Sep2020, Oct2019],
    [Oct2020, Oct2020],
  ])('CalDate%s -> FiscalYr%s', (cDate, expYear) => {
    expect(startOfFiscalYear(cDate)).toEqual(expYear);
  });
});

describe('endOfFiscalYear', () => {
  it.each([
    [Feb2019, Sep302019],
    [Oct2019, Sep302020],
    [Nov2019, Sep302020],
    [Dec2019, Sep302020],
    [Jan2020, Sep302020],
    [Oct2020, Sep302021],
  ])('CalDate%s -> FiscalYr%s', (cDate, expYear) => {
    expect(endOfFiscalYear(cDate)).toEqual(expYear);
  });
});

describe('expandToFullFiscalYears', () => {
  it.each([
    [dInterval2020, dInterval2020],
    [dInterval2021, dInterval2021],
  ])('DateInterval%s -> FullFiscalYrs%s', (dateInt, expYears) => {
    expect(expandToFullFiscalYears(dateInt)).toEqual(expYears);
  });
});

describe('fullFiscalYear', () => {
  it.each([
    [2020, dInterval2020],
    [2021, dInterval2021],
  ])('YrNum%s -> FullFiscalYrInterval%s', (yrNum, fYearInterval) => {
    expect(fullFiscalYear(yrNum)).toEqual(fYearInterval);
  });
});
describe('fullFiscalQuarter', () => {
  it.each([
    [1, 2020, '2019-10-01/2019-12-31'],
    [2, 2020, '2020-01-01/2020-03-31'],
    [3, 2020, '2020-04-01/2020-06-30'],
    [4, 2020, '2020-07-01/2020-09-30'],
  ])('Q%s FY%s -> %o', (fiscalQuarter, fiscalYear, dateRange) => {
    expect(fullFiscalQuarter(fiscalQuarter, fiscalYear).toISO()).toEqual(
      dateRange
    );
  });
});
