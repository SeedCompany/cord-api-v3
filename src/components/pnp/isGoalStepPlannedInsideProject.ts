import { fullFiscalYear } from '../../common';
import { PlanningSheet } from './planning-sheet';

export const isGoalStepPlannedInsideProject = (
  fiscalYear: number | undefined,
  sheet: PlanningSheet
) => {
  const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;

  // only include step if it references a fiscal year within the project
  return !fullFY || !sheet.projectFiscalYears.intersection(fullFY)
    ? undefined
    : fullFY;
};
