import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

/**
 * Part 3 of the narrative report: what else the team did this quarter.
 *
 * A PromptVariantResponse rather than a plain rich-text field on the report,
 * which is what earns this its variant lane for free — a partner writes, a
 * translator translates, Field Operations reviews, Investor Communications
 * publishes — along with the per-role edit grants, the accordion UI, and the
 * write path Rev79 and (later) the document importer already use. A plain field
 * would need every one of those built by hand, and would need a second answer
 * for what happens when a partner submits in French.
 *
 * Registered with no `db` argument and no ResourceDBMap entry: both are
 * optional, and nothing new here targets Gel.
 */
@RegisterResource()
export class ProgressReportOtherActivities extends PromptVariantResponse<OtherActivitiesVariant> {
  static readonly Parent = () =>
    import('./progress-report.dto').then((m) => m.ProgressReport);
  static Variants = ProgressReportHighlight.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type OtherActivitiesVariant = VariantOf<
  typeof ProgressReportOtherActivities
>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportOtherActivities: typeof ProgressReportOtherActivities;
  }
}
