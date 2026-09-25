import { type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';
import { ProgressReportHighlight } from './highlights.dto';

@RegisterResource()
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
}
