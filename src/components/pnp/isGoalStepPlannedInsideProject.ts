import { trimStart } from 'lodash';
import { fullFiscalYear } from '~/common';
import { Cell } from '~/common/xlsx.util';
import { ProductStep } from '../product/dto';
import { PnpExtractionResult } from './extraction-result';
import { PlanningSheet } from './planning-sheet';
import { Pnp } from './pnp';

/**
 * Does step reference a fiscal year within the project
 */
export const isGoalStepPlannedInsideProject = (
  pnp: Pnp,
  cell: Cell<PlanningSheet>,
  step: ProductStep,
  result: PnpExtractionResult,
) => {
  const fullFY = stepPlanCompleteDate(cell);
  const fiscalYear = new Date(String(fullFY)).getFullYear();
  const isPlanned =
    !!fullFY && pnp.planning.projectFiscalYears.contains(fullFY);
  if (isPlanned) {
    return true;
  }
  if (!fullFY) {
    // Empty cell generates no problem
    return false;
  }
  const goalLabel = pnp.planning.goalName(cell.row).asString ?? '';
  const stepLabel = ProductStep.entry(step).label;

  if (pnp.planning.projectFiscalYears.isAfter(fullFY)) {
    result.addProblem({
      severity: 'Notice',
      groups: [
        `Step(s) of goal(s) were finished **before** this project's fiscal years`,
        `Step(s) of _${goalLabel}_ were finished **before** this project's fiscal years`,
      ],
      message: `Ignoring _${stepLabel}_ for _${goalLabel}_ \`${cell.ref}\` which was finished _FY${fiscalYear}_ before this project's fiscal years`,
      source: cell,
    });
  } else {
    result.addProblem({
      severity: 'Error',
      groups: [
        `Step(s) of goal(s) are planned to be complete **after** this project's fiscal years`,
        `Step(s) of _${goalLabel}_ are planned to be complete **after** this project's fiscal years`,
      ],
      message: `_${stepLabel}_ for _${goalLabel}_ \`${cell.ref}\` is planned to be completed _FY${fiscalYear}_ which is **after** this project's fiscal years. For more information see the PnP Troubleshooting 
            <a href="https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps#5-steps-of-goals-are-planned-to-be-complete-after-this-projects-fiscal-years" target="_blank">Guide</a>`,
      source: cell,
    });
  }
  return false;
};

export const stepPlanCompleteDate = (cell: Cell<PlanningSheet>) => {
  const fiscalYear =
    cell.asNumber ?? (Number(trimStart(cell.asString ?? '', `'`)) || undefined);
  const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
  return fullFY?.end;
};
