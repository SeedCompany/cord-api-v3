import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import { CalendarDate, DateInterval, fullFiscalQuarter } from '../../common';
import * as IsProgressCompletedOutsideProject from './isProgressCompletedOutsideProject';
import {
  isProgressCompletedOutsideProject,
  stepCompleteDate,
} from './isProgressCompletedOutsideProject';
import { Pnp } from './pnp';
import { ProgressSheet } from './progress-sheet';

const outsideRange = DateTime.local(2018, 1, 1);
const fourthQuarterStart = DateTime.local(2020, 10, 1);
const fourthQuarterEnd = DateTime.local(2020, 12, 31);
const fourthQuarter = DateInterval.fromDateTimes(
  fourthQuarterStart,
  fourthQuarterEnd
);

let pnp: Pnp;
let progressSheet: ProgressSheet;

jest.mock('../../common/fiscal-year.ts', () => ({
  fullFiscalQuarter: jest.fn().mockImplementation(() => fourthQuarter),
}));

const stepCompleteDateSpy = jest.spyOn(
  IsProgressCompletedOutsideProject,
  'stepCompleteDate'
);

beforeAll(async () => {
  pnp = Pnp.fromBuffer(await fs.readFile('./test/pnp/ExamplePnP.xlsx'));
  progressSheet = pnp.progress;
});

describe('isProgressCompletedOutsideProject', () => {
  it('[R26] should return true when complete date exists and is not within the project date range', () => {
    const cell = progressSheet.cell('R26');

    stepCompleteDateSpy.mockImplementation(() =>
      CalendarDate.fromDateTime(outsideRange)
    );

    const actualProgressCompletion = isProgressCompletedOutsideProject(
      pnp,
      cell
    );

    expect(actualProgressCompletion).toEqual(true);
    expect(stepCompleteDateSpy).toBeCalledTimes(1);
  });

  it('[R24] should return null when complete date does not exist', () => {
    const cell = progressSheet.cell('R24');

    stepCompleteDateSpy.mockImplementation(() => null);

    const actualProgressCompletion = isProgressCompletedOutsideProject(
      pnp,
      cell
    );

    expect(actualProgressCompletion).toEqual(null);
    expect(stepCompleteDateSpy).toBeCalledTimes(2);
  });

  it('[R25] should return false when complete date exists but is within the project date range', () => {
    const cell = progressSheet.cell('R25');

    stepCompleteDateSpy.mockImplementation(() =>
      CalendarDate.fromDateTime(fourthQuarterStart)
    );

    const actualProgressCompletion = isProgressCompletedOutsideProject(
      pnp,
      cell
    );

    expect(actualProgressCompletion).toEqual(false);
    expect(stepCompleteDateSpy).toBeCalledTimes(3);
  });
});

describe('stepCompleteDate', () => {
  it('[R23] should return null when fiscal quarter is nullish', () => {
    stepCompleteDateSpy.mockRestore();

    const cell = progressSheet.cell('R23');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toBeNull();
  });

  it('[R24] should return null when fiscal year is nullish', () => {
    const cell = progressSheet.cell('R24');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toBeNull();
  });

  it('[R25] should return end of full fiscal quarter when valid cell is passed in', () => {
    const cell = progressSheet.cell('R25');

    const actualStepCompleteDate = stepCompleteDate(cell);

    expect(actualStepCompleteDate).toEqual(fourthQuarter.end);
    expect(fullFiscalQuarter).toBeCalledTimes(1);
  });
});
