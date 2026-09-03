import { Injectable } from '@nestjs/common';
import { type ID, UnauthorizedException, type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseFeaturedDrizzleRepository } from '../../prompts/prompt-variant-response-featured.drizzle.repository';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import { type ProgressReportCommunityStory as CommunityStory } from '../dto/community-stories.dto';
import { prompts } from './community-story-prompts';
import { ProgressReportCommunityStoryRepository } from './progress-report-community-story.repository';

@Injectable()
export class ProgressReportCommunityStoryService extends PromptVariantResponseListService(
  ProgressReportCommunityStoryRepository,
) {
  constructor(
    private readonly featuredRepo: PromptVariantResponseFeaturedDrizzleRepository,
  ) {
    super();
  }

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

  /**
   * Mark this story as the one for the investor/published report, clearing
   * whichever story previously held that on the same report.
   *
   * Authorization is a single field-level check — edit access to `featured` —
   * because that is the entire decision. Nothing else about the story changes.
   */
  async feature(id: ID): Promise<CommunityStory> {
    const existing = await this.repo.readOne(id);
    const secured = await this.secure(existing);
    if (!secured.featured.canEdit) {
      throw new UnauthorizedException(
        'You do not have permission to choose the featured story',
      );
    }

    await this.featuredRepo.feature(
      id,
      existing.parent.properties.id,
      this.repo.resource.name,
    );

    return await this.secure(await this.repo.readOne(id));
  }
}
