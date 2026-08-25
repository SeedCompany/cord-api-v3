import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

/**
 * Part 4 of the narrative report: what the team plans for next quarter.
 *
 * Same shape and the same reasoning as {@link ProgressReportOtherActivities} —
 * see that class for why these are prompt responses rather than fields.
 *
 * Kept as its own type rather than a second prompt on one shared response set,
 * because the two answer different questions and are reviewed at different
 * points: what happened is checked against the quarter that just closed, what
 * is planned is checked against the plan. Collapsing them would also make the
 * step UI a single box holding both, which is exactly the undifferentiated
 * narrative blob this project exists to break apart.
 */
@RegisterResource()
export class ProgressReportNextQuarterPlans extends PromptVariantResponse<NextQuarterPlansVariant> {
  static readonly Parent = () =>
    import('./progress-report.dto').then((m) => m.ProgressReport);
  static Variants = ProgressReportHighlight.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type NextQuarterPlansVariant = VariantOf<
  typeof ProgressReportNextQuarterPlans
>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportNextQuarterPlans: typeof ProgressReportNextQuarterPlans;
  }
}
