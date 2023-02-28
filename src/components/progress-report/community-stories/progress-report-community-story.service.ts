import { Injectable } from '@nestjs/common';
import { UnsecuredDto } from '~/common';
import {
  withEffectiveSensitivity,
  withScope,
} from '../../authorization/policies/conditions';
import { Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { ProgressReport } from '../dto';
import { ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';
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

const prompts = [
  Prompt.create({
    id: 'bnrqZXOtEeW',
    text: 'What are some responses you have seen in the community? Think of community outreach, youth camps, and other community events related to this project. (Ex: increased unity, freedom from false religions, less violence, etc.)',
  }),
  Prompt.create({
    id: 'Bn3zwnzb3JN',
    text: 'How was the translated Scripture used among the churches, local ministries, or other groups in the last quarter?',
  }),
  Prompt.create({
    id: 'MsdfnoZkYda',
    text: 'Share a specific example of how translated Scripture changed or challenged the way one person viewed themselves, others, and/or God. (Ex: in marriage, parenting, family life, personal growth, friendships, relationship with God, etc.)',
  }),
  Prompt.create({
    id: 'P4FO95xsZ7A',
    text: 'Tell how someone responded to the Scripture in a checking session. Was there a passage that was meaningful to this specific person? If yes, what did they discover?',
  }),
];
