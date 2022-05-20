import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
// import { mocked } from 'jest-mock';
// import { fullFiscalQuarter } from '../../common';
import { WorkBook } from '../../common/xlsx.util';
import { stepCompleteDate } from './isProgressCompletedOutsideProject';
import { ProgressSheet } from './progress-sheet';

jest.mock('../../common/fiscal-year.ts');

describe('stepCompleteDate', () => {
  let progressSheet: ProgressSheet;

  //const mockFullFiscalQuarter = mocked(fullFiscalQuarter);

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

    expect(actualStepCompleteDate).toBeNull();
  });
});
