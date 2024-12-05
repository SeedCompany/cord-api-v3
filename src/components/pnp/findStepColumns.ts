import { sortBy } from '@seedcompany/common';
import levenshtein from 'fastest-levenshtein';
import { startCase, without } from 'lodash';
import { Column } from '~/common/xlsx.util';
import { ProductStep as Step } from '../product/dto';
import { PnpExtractionResult, PnpProblemType } from './extraction-result';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';
import 'ix/add/iterable-operators/filter.js';
import 'ix/add/iterable-operators/map.js';
import 'ix/add/iterable-operators/toarray.js';

/**
 * Fuzzy match available steps to their column address.
 */
export function findStepColumns(
  sheet: PlanningSheet | ProgressSheet,
  result?: PnpExtractionResult,
  availableSteps: readonly Step[] = [...Step],
) {
  const matchedColumns: Partial<Record<Step, Column>> = {};
  let remainingSteps = availableSteps;
  const possibleSteps = sheet.stepLabels
    .walkRight()
    .filter((cell) => !!cell.asString)
    .map((cell) => ({ label: cell.asString!, column: cell.column, cell }))
    .toArray();
  possibleSteps.forEach(({ label, column, cell }, index) => {
    if (index === possibleSteps.length - 1) {
      // The last step should always be called Completed in CORD per Seth.
      // Written PnP already match, but OBS calls it Record. This is mislabeled
      // depending on the methodology.
      matchedColumns[Step.Completed] = column;
      return;
    }
    const distances = remainingSteps.map((step) => {
      const humanLabel = startCase(step).replace(' And ', ' & ');
      const distance = levenshtein.distance(label, humanLabel);
      return [step, distance] as const;
    });
    // Pick the step that is the closest fuzzy match
    const chosen = sortBy(
      // 5 is too far ignore those
      distances.filter(([_, distance]) => distance < 5),
      ([_, distance]) => distance,
    )[0]?.[0];
    if (!chosen) {
      result?.addProblem(NonStandardStep, cell, { label });
      return;
    }
    matchedColumns[chosen] = column;

    remainingSteps = without(remainingSteps, chosen);
  });
  return matchedColumns as Record<Step, Column>;
}

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
