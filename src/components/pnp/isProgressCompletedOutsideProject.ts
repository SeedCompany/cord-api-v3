import {
  CalendarDate,
  fiscalQuarter,
  fiscalYear,
  fullFiscalQuarter,
} from '~/common';
import { Cell } from '~/common/xlsx.util';
import { ProductStep } from '../product/dto';
import { PnpExtractionResult, PnpProblemType } from './extraction-result';
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
  // Steps completion dates smallest unit is quarters, so expand project range to that.
  const projectTimeframe =
    pnp.planning.projectDateRange.expandToFull('quarter');
  if (projectTimeframe.contains(completeDate)) {
    return false;
  }

  const goalLabel = pnp.planning.goalName(cell.row).asString ?? '';

  const type = projectTimeframe.isAfter(completeDate)
    ? GoalProgressedBeforeProject
    : GoalProgressedAfterProject;
  result.addProblem(type, cell, {
    step,
    goal: goalLabel,
    completed: completeDate.toISO(),
  });
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

const GoalProgressedBeforeProject = PnpProblemType.register({
  name: 'GoalProgressedBeforeProject',
  severity: 'Notice',
  render:
    (...raw: Parameters<typeof renderCtx>) =>
    ({ source }) => {
      const ctx = renderCtx(...raw);
      return {
        groups: [
          `Step(s) of goal(s) were finished **before** this project`,
          `Step(s) of _${ctx.goal}_ were finished **before** this project`,
        ],
        message: `Ignoring _${ctx.step}_ for _${ctx.goal}_ \`${source}\` which was finished _${ctx.completed}_ before this project started`,
      };
    },
});

const GoalProgressedAfterProject = PnpProblemType.register({
  name: 'GoalProgressedAfterProject',
  severity: 'Error',
  render:
    (...raw: Parameters<typeof renderCtx>) =>
    ({ source }) => {
      const ctx = renderCtx(...raw);
      return {
        groups: [
          `Step(s) of goal(s) are marked complete **after** this project's date range`,
          `Step(s) of _${ctx.goal}_ are marked complete **after** this project's date range`,
        ],
        message: `_${ctx.step}_ for _${ctx.goal}_ \`${source}\` is marked completed on _${ctx.completed}_ which is **after** this project ends`,
      };
    },
  wiki: 'https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps#6-steps-of-goals-are-marked-complete-after-this-projects-date-range',
});

const renderCtx = (ctx: {
  goal: string;
  step: ProductStep;
  completed: string;
}) => {
  const step = ProductStep.entry(ctx.step).label;
  const date = CalendarDate.fromISO(ctx.completed);
  const completed = `Q${fiscalQuarter(date)} FY${fiscalYear(date)}`;
  return { ...ctx, step, completed };
};
