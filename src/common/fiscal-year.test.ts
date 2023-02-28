import { DateTime } from 'luxon';
import { fiscalYear } from '.';
import { fullFiscalQuarter } from './fiscal-year';

describe('fiscal-year', () => {
  //TODO - This is an example as to what a single test case WOULD be like with a
  // standard 'it' statement.  However, due to the nature of this function it should also be
  // transformed into the case below using the 'it.each' to easily cover all cases
  it('should return current year when date is in second quarter', () => {
    const regularDate = DateTime.fromObject({ year: 2020, month: 6, day: 1 });

    expect(fiscalYear(regularDate)).toEqual(2020);
  });
});

describe('fullFiscalQuarter', () => {
  it.each([
    [1, 2020, '2019-10-01/2019-12-31'],
    [2, 2020, '2020-01-01/2020-03-31'],
    [3, 2020, '2020-04-01/2020-06-30'],
    [4, 2020, '2020-07-01/2020-09-30'],
  ])('Q%s FY%s -> %s', (fiscalQuarter, fiscalYear, dateRange) => {
    expect(fullFiscalQuarter(fiscalQuarter, fiscalYear).toISO()).toEqual(
      dateRange,
    );
  });
});
