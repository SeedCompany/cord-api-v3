import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

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
