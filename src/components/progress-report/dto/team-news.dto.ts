import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps, VariantOf } from '~/common';
import { RegisterResource } from '~/core';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './hightlights.dto';

@RegisterResource()
export class ProgressReportTeamNews extends PromptVariantResponse<TeamNewsVariant> {
  static Props = keysOf<ProgressReportTeamNews>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportTeamNews>>();
  static readonly Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport
  );
  static Variants = ProgressReportHighlight.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type TeamNewsVariant = VariantOf<typeof ProgressReportTeamNews>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportTeamNews: typeof ProgressReportTeamNews;
  }
}
