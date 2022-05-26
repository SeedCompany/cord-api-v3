import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import { CalendarDate, DateInterval } from '../../common';
import * as FiscalYear from '../../common/fiscal-year';
import { WorkBook } from '../../common/xlsx.util';
import { Pnp } from '../../components/pnp';
import {
  isGoalStepPlannedInsideProject,
  stepPlanCompleteDate,
} from './isGoalStepPlannedInsideProject';
import { PlanningSheet } from './planning-sheet';

const fiscalYear2019 = DateInterval.fromDateTimes(
  CalendarDate.local(2018, 10, 1),
  CalendarDate.local(2019, 9, 30)
);

const mockFullFiscalYear = jest.spyOn(FiscalYear, 'fullFiscalYear');
mockFullFiscalYear.mockReturnValue(fiscalYear2019);

//test cases for stepPlanCompleteDate
describe('stepPlanCompleteDate', () => {
  let planningSheet: PlanningSheet;

  beforeAll(async () => {
    planningSheet = WorkBook.fromBuffer(
      await fs.readFile('./test/pnp/ExamplePnP.xlsx')
    ).sheet('Planning');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return the end month of the full fiscal year when valid cell is passed in', () => {
    const cell = planningSheet.cell('U23');
    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);
    expect(actualStepPlanCompleteDate).toEqual(DateTime.local(2019, 9, 30));
  });

  it('should return null when fiscal year is nullish', () => {
    const cell = planningSheet.cell('U27');
    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);
    expect(actualStepPlanCompleteDate).toBeUndefined();
  });
});

//test cases for isGoalStepPlannedInsidedProject
describe('isGoalStepPlannedInsideProject', () => {
  let testPnp: Pnp;
  let planningSheet: PlanningSheet;
  mockFullFiscalYear.mockRestore();

  beforeAll(async () => {
    testPnp = Pnp.fromBuffer(await fs.readFile('./test/pnp/ExamplePnP.xlsx'));
    planningSheet = testPnp.planning;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('[U23] should return false when cell contains a date before the project date range', () => {
    const cell = planningSheet.cell('U23');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
  });

  it('[U24] should return true when cell contains a date within the project date range', () => {
    const cell = planningSheet.cell('U24');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(true);
  });

  it('[U26] should return false when cell contains a date after the project date range', () => {
    const cell = planningSheet.cell('U26');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
  });

  it('[U27] should return false when cell is empty/undefined', () => {
    const cell = planningSheet.cell('U27');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
  });
});
