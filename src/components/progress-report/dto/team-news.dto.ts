import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps, VariantOf } from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource({ db: e.ProgressReport.TeamNews })
export class ProgressReportTeamNews extends PromptVariantResponse<TeamNewsVariant> {
  static Props = keysOf<ProgressReportTeamNews>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportTeamNews>>();
  static readonly Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport,
  );
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
