import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DateInterval,
  expandToFullFiscalYears,
  fullFiscalYear,
} from '../../common';
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

const projectYears = DateInterval.fromDateTimes(
  CalendarDate.local(2019, 10, 1),
  CalendarDate.local(2022, 9, 30)
);

jest.mock('../../common/fiscal-year', () => {
  return {
    fullFiscalYear: jest.fn().mockImplementation(() => fiscalYear2019),
    expandToFullFiscalYears: jest.fn().mockImplementation(() => projectYears),
  };
});

//test cases for stepPlanCompleteDate
describe('stepPlanCompleteDate', () => {
  let planningSheet: PlanningSheet;

  beforeAll(async () => {
    planningSheet = WorkBook.fromBuffer(
      await fs.readFile('./test/pnp/ExamplePnP.xlsx')
    ).sheet('Planning');
  });

  it('should return the end month of the full fiscal year when valid cell is passed in', () => {
    const cell = planningSheet.cell('U23');
    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);
    expect(actualStepPlanCompleteDate).toEqual(DateTime.local(2019, 9, 30));
    expect(fullFiscalYear).toBeCalledTimes(1);
  });

  it('should return null when fiscal year is nullish', () => {
    const cell = planningSheet.cell('U27');
    const actualStepPlanCompleteDate = stepPlanCompleteDate(cell);
    expect(actualStepPlanCompleteDate).toBeUndefined();
  });
});

//test cases for isGoalStepPlannedInsidedProject
describe('isGoalStepPlannedInsideProject (Mar-2020 to Sep-2022)', () => {
  let testPnp: Pnp;
  let planningSheet: PlanningSheet;

  beforeAll(async () => {
    testPnp = Pnp.fromBuffer(await fs.readFile('./test/pnp/ExamplePnP.xlsx'));
    planningSheet = testPnp.planning;
  });

  it('cell U23 (stepcomplete by 9-30-2019) should return false', () => {
    const cell = planningSheet.cell('U23');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
    expect(expandToFullFiscalYears).toBeCalledTimes(1);
  });

  it('cell U24 (stepcomplete by 9-30-2020) should return true', () => {
    const cell = planningSheet.cell('U24');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(true);
    expect(expandToFullFiscalYears).toBeCalledTimes(1);
  });

  it('cell U25 (stepcomplete by 9-30-2021) should return true', () => {
    const cell = planningSheet.cell('U25');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(true);
    expect(expandToFullFiscalYears).toBeCalledTimes(1);
  });

  it('cell U26 (stepcomplete by 9-30-2023) should return false', () => {
    const cell = planningSheet.cell('U26');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
    expect(expandToFullFiscalYears).toBeCalledTimes(1);
  });

  it('cell U27 (stepcomplete by empty/undefined) should return false', () => {
    const cell = planningSheet.cell('U27');
    const results = isGoalStepPlannedInsideProject(testPnp, cell);
    expect(results).toEqual(false);
  });
});
