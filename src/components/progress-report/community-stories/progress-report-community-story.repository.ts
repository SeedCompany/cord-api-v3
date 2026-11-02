import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';

@Injectable()
export class ProgressReportCommunityStoryRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'communityStories'],
  CommunityStory,
) {}
