import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource()
export class ProgressReportTeamNews extends PromptVariantResponse<TeamNewsVariant> {
  static readonly Parent = () =>
    import('./progress-report.dto').then((m) => m.ProgressReport);
  static Variants = ProgressReportHighlight.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type TeamNewsVariant = VariantOf<typeof ProgressReportTeamNews>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportTeamNews: typeof ProgressReportTeamNews;
  }
}
