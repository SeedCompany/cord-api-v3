import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps, VariantOf } from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource({ db: e.ProgressReport.CommunityStory })
export class ProgressReportCommunityStory extends PromptVariantResponse<CommunityStoryVariant> {
  static Props = keysOf<ProgressReportCommunityStory>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportCommunityStory>>();
  static readonly Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport,
  );
  static Variants = ProgressReportHighlight.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type CommunityStoryVariant = VariantOf<
  typeof ProgressReportCommunityStory
>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportCommunityStory: typeof ProgressReportCommunityStory;
  }
  interface ResourceDBMap {
    ProgressReportCommunityStory: typeof e.ProgressReport.CommunityStory;
  }
}
