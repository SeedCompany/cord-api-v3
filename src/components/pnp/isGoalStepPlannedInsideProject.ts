import { trimStart } from 'lodash';
import { CalendarDate, fullFiscalYear } from '../../common';
import { Cell } from '../../common/xlsx.util';
import { PlanningSheet } from './planning-sheet';
import { Pnp } from './pnp';

/**
 * Does step reference a fiscal year within the project
 */
export const isGoalStepPlannedInsideProject = (
  pnp: Pnp,
  cell: Cell<PlanningSheet> | CalendarDate | undefined
): cell is CalendarDate => {
  const fullFY = cell instanceof Cell ? stepPlanCompleteDate(cell) : cell;
  return !!fullFY && pnp.planning.projectFiscalYears.contains(fullFY);
};

export const stepPlanCompleteDate = (cell: Cell<PlanningSheet>) => {
  const fiscalYear =
    cell.asNumber ?? (Number(trimStart(cell.asString ?? '', `'`)) || undefined);
  const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
  return fullFY?.end;
};
