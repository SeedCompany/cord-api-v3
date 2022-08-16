import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import { DateInterval, fullFiscalQuarter } from '../../common';
import { WorkBook } from '../../common/xlsx.util';
import { stepCompleteDate } from './isProgressCompletedOutsideProject';
import { ProgressSheet } from './progress-sheet';

const fourthQuarterStart = DateTime.local(2020, 10, 1);
const fourthQuarterEnd = DateTime.local(2020, 12, 31);
const fourthQuarter = DateInterval.fromDateTimes(
  fourthQuarterStart,
  fourthQuarterEnd
);

jest.mock('../../common/fiscal-year.ts', () => ({
  fullFiscalQuarter: jest.fn().mockImplementation(() => fourthQuarter),
}));

describe('stepCompleteDate', () => {
  let progressSheet: ProgressSheet;

  beforeAll(async () => {
    progressSheet = WorkBook.fromBuffer(
      await fs.readFile('./test/pnp/ExamplePnP.xlsx')
    ).sheet('Progress');
  });

  it('should return null when fiscal quarter is nullish', () => {
    const cell = progressSheet.cell('R23');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toBeNull();
  });

  it('should return null when fiscal year is nullish', () => {
    const cell = progressSheet.cell('R24');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toBeNull();
  });

  it('should return end of full fiscal quarter when valid cell is passed in', () => {
    const cell = progressSheet.cell('R25');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toEqual(fourthQuarter.end);
    expect(fullFiscalQuarter).toBeCalledTimes(1);
  });
});
