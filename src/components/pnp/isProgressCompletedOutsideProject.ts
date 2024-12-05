import { fiscalQuarter, fiscalYear, fullFiscalQuarter } from '~/common';
import { Cell } from '~/common/xlsx.util';
import { ProductStep } from '../product/dto';
import { PnpExtractionResult } from './extraction-result';
import { Pnp } from './pnp';
import { ProgressSheet } from './progress-sheet';

export const isProgressCompletedOutsideProject = (
  pnp: Pnp,
  cell: Cell<ProgressSheet>,
  step: ProductStep,
  result: PnpExtractionResult,
) => {
  const completeDate = stepCompleteDate(cell);
  if (!completeDate) {
    return false;
  }
  if (pnp.planning.projectDateRange.contains(completeDate)) {
    return false;
  }

  const stepLabel = ProductStep.entry(step).label;
  const goalLabel = pnp.planning.goalName(cell.row).asString ?? '';
  const dateLabel = `Q${fiscalQuarter(completeDate)} FY${fiscalYear(
    completeDate,
  )}`;

  if (pnp.planning.projectDateRange.isAfter(completeDate)) {
    result.addProblem({
      severity: 'Notice',
      groups: [
        `Step(s) of goal(s) were finished **before** this project`,
        `Step(s) of _${goalLabel}_ were finished **before** this project`,
      ],
      message: `Ignoring _${stepLabel}_ for _${goalLabel}_ \`${cell.ref}\` which was finished _${dateLabel}_ before this project started`,
      source: cell,
    });
  } else {
    result.addProblem({
      severity: 'Error',
      groups: [
        `Step(s) of goal(s) are marked complete **after** this project's date range`,
        `Step(s) of _${goalLabel}_ are marked complete **after** this project's date range`,
      ],
      message: `_${stepLabel}_ for _${goalLabel}_ \`${cell.ref}\` is marked completed on _${dateLabel}_ which is **after** this project ends. For more information see the PnP Troubleshooting 
            <a href="https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps" target="_blank">Guide</a>`,
      source: cell,
    });
  }
  return true;
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
