import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PeriodicReportLoader } from '../../periodic-report';
import { type PeriodicReport } from '../../periodic-report/dto';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { type CommunityStoryVariant } from '../dto/community-stories.dto';
import { ProgressReportCommunityStoryService } from './progress-report-community-story.service';

@Resolver(ProgressReport)
export class ProgressReportCommunityStoryResolver {
  constructor(private readonly service: ProgressReportCommunityStoryService) {}

  @ResolveField(() => PromptVariantResponseList)
  async communityStories(
    @Parent() report: ProgressReport,
  ): Promise<PromptVariantResponseList<CommunityStoryVariant>> {
    return await this.service.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportCommunityStory(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportCommunityStoryPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportCommunityStoryResponse(
    @Args('input')
    input: UpdatePromptVariantResponse<CommunityStoryVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => [PromptVariantResponse], {
    description: stripIndent`
      Choose this story as the report's featured community story.

      Returns every story whose \`featured\` changed: the chosen one first,
      then the one it displaced, if any — so both can be updated from one
      response.
    `,
  })
  async featureProgressReportCommunityStory(
    @IdArg() id: ID<PromptVariantResponse>,
  ): Promise<ReadonlyArray<PromptVariantResponse<CommunityStoryVariant>>> {
    return await this.service.feature(id);
  }

  @Mutation(() => PromptVariantResponse, {
    description:
      'Take the featured place away from this story, leaving the report with no featured story.',
  })
  async unfeatureProgressReportCommunityStory(
    @IdArg() id: ID<PromptVariantResponse>,
  ): Promise<PromptVariantResponse<CommunityStoryVariant>> {
    return await this.service.unfeature(id);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportCommunityStory(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
