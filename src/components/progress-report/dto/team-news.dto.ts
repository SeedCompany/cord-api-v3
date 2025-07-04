import { type VariantOf } from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource({ db: e.ProgressReport.TeamNews })
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
  interface ResourceDBMap {
    ProgressReportTeamNews: typeof e.ProgressReport.TeamNews;
  }
}
