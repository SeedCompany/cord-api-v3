import { Injectable } from '@nestjs/common';
import { UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { ProgressReport } from '../dto';
import { ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';
import { prompts } from './community-story-prompts';
import { ProgressReportCommunityStoryRepository } from './progress-report-community-story.repository';

@Injectable()
export class ProgressReportCommunityStoryService extends PromptVariantResponseListService(
  ProgressReportCommunityStoryRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<CommunityStory>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
