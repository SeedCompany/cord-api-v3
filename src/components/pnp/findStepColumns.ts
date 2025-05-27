import { sortBy } from '@seedcompany/common';
import levenshtein from 'fastest-levenshtein';
import { startCase, without } from 'lodash';
import { type Column } from '~/common/xlsx.util';
import { ProductStep as Step } from '../product/dto';
import { type PnpExtractionResult, PnpProblemType } from './extraction-result';
import { type PlanningSheet } from './planning-sheet';
import { type ProgressSheet } from './progress-sheet';

const ApprovedCustomSteps = new Map<string, Step>([
  ['draft & keyboard', Step.ExegesisAndFirstDraft],
  ['first draft', Step.ExegesisAndFirstDraft],
  ['exegesis, 1st draft, keyboard', Step.ExegesisAndFirstDraft],
  ['internalization & first draft', Step.ExegesisAndFirstDraft],
  ['exegesis 1st draft & keybrd', Step.ExegesisAndFirstDraft],
  ['first draft & keyboard', Step.ExegesisAndFirstDraft],
  ['exegesis, 1st draft. keyboard', Step.ExegesisAndFirstDraft],
  ['team check & 1st testing', Step.TeamCheck],
  ['team check & revision', Step.TeamCheck],
  ['team check & 1st test', Step.TeamCheck],
  ['field test', Step.CommunityTesting],
  ['community check', Step.CommunityTesting],
  ['community review', Step.CommunityTesting],
  ['community testing & revision', Step.CommunityTesting],
]);

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
    .map((cell) => ({
      label:
        ApprovedCustomSteps.get(cell.asString!.trim().toLowerCase()) ??
        cell.asString!,
      column: cell.column,
      cell,
    }))
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
