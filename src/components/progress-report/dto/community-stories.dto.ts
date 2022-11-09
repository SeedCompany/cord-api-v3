import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { RegisterResource } from '~/core';
import { PromptVariantResponse } from '../../prompts/dto';
import { VariantOf } from '../../prompts/dto/variant.dto';
import { ProgressReportHighlight } from './hightlights.dto';

@RegisterResource()
export class ProgressReportCommunityStory extends PromptVariantResponse<CommunityStoryVariant> {
  static Props = keysOf<ProgressReportCommunityStory>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportCommunityStory>>();
  static readonly Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport
  );
  static Variants = ProgressReportHighlight.Variants;
}

export type CommunityStoryVariant = VariantOf<
  typeof ProgressReportCommunityStory
>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportCommunityStory: typeof ProgressReportCommunityStory;
  }
}
