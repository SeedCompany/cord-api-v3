import { sortBy } from '@seedcompany/common';
import levenshtein from 'fastest-levenshtein';
import { startCase } from 'lodash';
import { type Column } from '~/common/xlsx.util';
import { ProductStep as Step } from '../product/dto';
import { type PnpExtractionResult, PnpProblemType } from './extraction-result';
import { type PlanningSheet } from './planning-sheet';
import { type ProgressSheet } from './progress-sheet';

/**
 * Fuzzy match available steps to their column address.
 */
export function findStepColumns(
  sheet: PlanningSheet | ProgressSheet,
  result?: PnpExtractionResult,
  availableSteps: readonly Step[] = [...Step],
) {
  const matchedColumns = new Map<Step, Column>();
  const remainingSteps = new Set(availableSteps);
  const possibleSteps = sheet.stepLabels
    .walkRight()
    .filter((cell) => !!cell.asString)
    .map((cell) => ({
      label: cell.asString!.trim(),
      column: cell.column,
      cell,
    }))
    .toArray();
  possibleSteps.forEach(({ label, column, cell }, index) => {
    if (index === possibleSteps.length - 1) {
      // The last step should always be called Completed in CORD per Seth.
      // Written PnP already matches, but OBS calls it Record.
      // This is mislabeled depending on the methodology.
      matchedColumns.set(Step.Completed, column);
      return;
    }

    const chosen = chooseStep(label, remainingSteps);
    if (!chosen) {
      result?.addProblem(NonStandardStep, cell, { label });
      return;
    }
    matchedColumns.set(chosen, column);
    remainingSteps.delete(chosen);
  });
  return matchedColumns as ReadonlyMap<Step, Column>;
}

const chooseStep = (
  label: string,
  available: ReadonlySet<Step>,
): Step | undefined => {
  const distances = available.values().map((step) => {
    const humanLabel = startCase(step).replace(' And ', ' & ');
    const distance = levenshtein.distance(label, humanLabel);
    return { step, distance };
  });
  // Pick the step that is the closest fuzzy match
  const chosen = sortBy(
    // 5 is too far ignoring those
    distances.filter(({ distance }) => distance < 5),
    ({ distance }) => distance,
  ).at(0);
  return chosen?.step;
};

const NonStandardStep = PnpProblemType.register({
  name: 'NonStandardStep',
  severity: 'Error',
  render:
    ({ label }: Record<'label', string>) =>
    ({ source }) => ({
      groups: 'The step header label is non standard',
      message: `"${label}" \`${source}\` is not a standard step label`,
    }),
  wiki: 'https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps#3-step-header-label-is-non-standard',
});
