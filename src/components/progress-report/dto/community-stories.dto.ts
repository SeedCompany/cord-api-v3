import { type VariantOf } from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource({ db: e.ProgressReport.CommunityStory })
export class ProgressReportCommunityStory extends PromptVariantResponse<CommunityStoryVariant> {
  static readonly Parent = () =>
    import('./progress-report.dto').then((m) => m.ProgressReport);
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
