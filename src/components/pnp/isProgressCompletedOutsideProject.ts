import { fullFiscalQuarter } from '../../common';
import { Cell } from '../../common/xlsx.util';
import { Pnp } from './pnp';
import { ProgressSheet } from './progress-sheet';

export const isProgressCompletedOutsideProject = (
  pnp: Pnp,
  cell: Cell<ProgressSheet>
) => {
  const completeDate = stepCompleteDate(cell);
  return completeDate && !pnp.planning.projectDateRange.contains(completeDate);
};

/**
 * Convert cell (and one to its right) to a calendar date.
 * ['Q2', '2022'] -> 03/31/2022
 */
const stepCompleteDate = (cell: Cell<ProgressSheet>) => {
  const fiscalQuarter = Number(cell.asString?.slice(1));
  const fiscalYear = cell.moveX(1).asNumber;
  if (!fiscalQuarter || !fiscalYear) {
    return null;
  }
  return fullFiscalQuarter(fiscalQuarter, fiscalYear).end;
};
