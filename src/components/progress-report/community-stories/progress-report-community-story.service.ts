import { Inject, Injectable } from '@nestjs/common';
import { type ID, UnauthorizedException, type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt, type PromptVariantResponse } from '../../prompts/dto';
import { PromptVariantResponseFeaturedRepository } from '../../prompts/prompt-variant-response-featured.repository';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import {
  type ProgressReportCommunityStory as CommunityStory,
  type CommunityStoryVariant,
} from '../dto/community-stories.dto';
import { prompts } from './community-story-prompts';
import { ProgressReportCommunityStoryRepository } from './progress-report-community-story.repository';

@Injectable()
export class ProgressReportCommunityStoryService extends PromptVariantResponseListService(
  ProgressReportCommunityStoryRepository,
) {
  @Inject(PromptVariantResponseFeaturedRepository)
  protected readonly featuredRepo: PromptVariantResponseFeaturedRepository;

  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  /**
   * Make this story the report's featured one, displacing whichever story held
   * that place. Returns every story whose `featured` changed — the newly
   * featured one first, then the displaced one if there was one — so a client
   * can update both from one response.
   */
  async feature(
    id: ID<PromptVariantResponse>,
  ): Promise<ReadonlyArray<PromptVariantResponse<CommunityStoryVariant>>> {
    const existing = await this.repo.readOne(id);
    await this.verifyCanChooseFeatured(existing);
    const changedIds = await this.featuredRepo.feature(
      id,
      existing.parent.properties.id,
      this.repo.resource.name,
    );
    return await Promise.all(
      changedIds.map(
        async (changed) => await this.secure(await this.repo.readOne(changed)),
      ),
    );
  }

  /** Take the featured place away from this story, leaving the report with none. */
  async unfeature(
    id: ID<PromptVariantResponse>,
  ): Promise<PromptVariantResponse<CommunityStoryVariant>> {
    const existing = await this.repo.readOne(id);
    await this.verifyCanChooseFeatured(existing);
    await this.featuredRepo.unfeature(id);
    return await this.secure(await this.repo.readOne(id));
  }

  private async verifyCanChooseFeatured(dto: UnsecuredDto<CommunityStory>) {
    const secured = await this.secure(dto);
    if (!secured.featured.canEdit) {
      throw new UnauthorizedException(
        'You do not have permission to choose the featured story',
      );
    }
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
