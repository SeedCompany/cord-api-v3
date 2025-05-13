import { Injectable } from '@nestjs/common';
import { type Session } from '~/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';
import { oncePerProjectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';

@Injectable()
export class ProgressReportCommunityStoryRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'communityStories'],
  CommunityStory,
) {
  protected filterToReadable(session: Session) {
    return this.privileges.filterToReadable({
      wrapContext: oncePerProjectFromProgressReportChild,
    });
  }
}
