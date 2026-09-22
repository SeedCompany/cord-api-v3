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
   *
   * Returns every story whose `featured` value changed — this one and
   * whichever it demoted — not just this one. The demoted story's `featured`
   * did change server-side; a response that omits it would leave the client
   * showing two stories featured until the next full refetch.
   */
  async feature(id: ID): Promise<readonly CommunityStory[]> {
    const existing = await this.repo.readOne(id);
    const secured = await this.secure(existing);
    if (!secured.featured.canEdit) {
      throw new UnauthorizedException(
        'You do not have permission to choose the featured story',
      );
    }

    const changedIds = await this.featuredRepo.feature(
      id,
      existing.parent.properties.id,
      this.repo.resource.name,
    );

    return await Promise.all(
      changedIds.map(
        async (changedId) =>
          await this.secure(await this.repo.readOne(changedId)),
      ),
    );
  }
}
