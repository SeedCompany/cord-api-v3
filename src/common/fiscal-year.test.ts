import { DateTime } from 'luxon';
import {
  fiscalQuarter,
  fiscalYear,
  fiscalYears,
  fullFiscalQuarter,
} from './fiscal-year';

const Feb2019 = DateTime.fromObject({ year: 2019, month: 2, day: 1 });
const Oct2019 = DateTime.fromObject({ year: 2019, month: 10, day: 1 });
const Nov2019 = DateTime.fromObject({ year: 2019, month: 11, day: 1 });
const Dec2019 = DateTime.fromObject({ year: 2019, month: 12, day: 1 });
const Jan2020 = DateTime.fromObject({ year: 2020, month: 1, day: 1 });
const Jun2020 = DateTime.fromObject({ year: 2020, month: 6, day: 1 });
const Sep2020 = DateTime.fromObject({ year: 2020, month: 9, day: 1 });
const Oct2020 = DateTime.fromObject({ year: 2020, month: 10, day: 1 });

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
