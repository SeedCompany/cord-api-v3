import { trimStart } from 'lodash';
import { fullFiscalYear } from '~/common';
import { Cell } from '~/common/xlsx.util';
import { ProductStep } from '../product/dto';
import { PnpExtractionResult, PnpProblemType } from './extraction-result';
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

  const type = pnp.planning.projectFiscalYears.isAfter(fullFY)
    ? GoalPlanAlreadyCompleteBeforeProject
    : GoalPlannedCompleteAfterProject;
  result.addProblem(type, cell, {
    step,
    goal: goalLabel,
    fiscalYear: fullFY.year,
  });
  return false;
};

export const stepPlanCompleteDate = (cell: Cell<PlanningSheet>) => {
  const fiscalYear =
    cell.asNumber ?? (Number(trimStart(cell.asString ?? '', `'`)) || undefined);
  const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
  return fullFY?.end;
};

const GoalPlanAlreadyCompleteBeforeProject = PnpProblemType.register({
  name: 'GoalPlanAlreadyCompleteBeforeProject',
  severity: 'Notice',
  render:
    (...raw: Parameters<typeof renderCtx>) =>
    ({ source }) => {
      const ctx = renderCtx(...raw);
      return {
        groups: [
          `Step(s) of goal(s) were finished **before** this project's fiscal years`,
          `Step(s) of _${ctx.goal}_ were finished **before** this project's fiscal years`,
        ],
        message: `Ignoring _${ctx.step}_ for _${ctx.goal}_ \`${source}\` which was finished _${ctx.fiscalYear}_ before this project's fiscal years`,
      };
    },
});

const GoalPlannedCompleteAfterProject = PnpProblemType.register({
  name: 'GoalPlannedCompleteAfterProject',
  severity: 'Error',
  render:
    (...raw: Parameters<typeof renderCtx>) =>
    ({ source }) => {
      const ctx = renderCtx(...raw);
      return {
        groups: [
          `Step(s) of goal(s) are planned to be complete **after** this project's fiscal years`,
          `Step(s) of _${ctx.goal}_ are planned to be complete **after** this project's fiscal years`,
        ],
        message: `_${ctx.step}_ for _${ctx.goal}_ \`${source}\` is planned to be completed _${ctx.fiscalYear}_ which is **after** this project's fiscal years`,
      };
    },
});

const renderCtx = (ctx: {
  goal: string;
  step: ProductStep;
  fiscalYear: number;
}) => {
  const step = ProductStep.entry(ctx.step).label;
  return { ...ctx, step, fiscalYear: `FY${ctx.fiscalYear}` };
};
