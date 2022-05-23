import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
// import { mocked } from 'jest-mock';
// import { fullFiscalQuarter } from '../../common';
import { WorkBook } from '../../common/xlsx.util';
import { stepPlanCompleteDate } from './isGoalStepPlannedInsideProject';
import { PlanningSheet } from './planning-sheet';

//jest.mock('../../common/fiscal-year.ts');

describe('stepPlanCompleteDate', () => {
  let planningSheet: PlanningSheet;

  //const mockFullFiscalYear = mocked(fullFiscalYear);

  beforeAll(async () => {
    planningSheet = WorkBook.fromBuffer(
      await fs.readFile('./test/pnp/ExamplePnP.xlsx')
    ).sheet('Planning');
  });

  it('should return the end month of the full fiscal year when valid cell is passed in', () => {
    const cell = planningSheet.cell('U23');

    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);

    expect(actualStepPlanCompleteDate).toEqual(DateTime.local(2019, 9, 30));
  });

  it('should return null when fiscal year is nullish', () => {
    const cell = planningSheet.cell('U28');

    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);

    expect(actualStepPlanCompleteDate).toBeUndefined();
  });
});
