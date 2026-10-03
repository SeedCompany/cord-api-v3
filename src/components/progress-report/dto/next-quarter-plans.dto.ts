import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

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
