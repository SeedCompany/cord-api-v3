import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { ProgressReport } from '../dto';
import { ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';

@Injectable()
export class ProgressReportCommunityStoryDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [ProgressReport, 'communityStories'],
  CommunityStory,
) {}
