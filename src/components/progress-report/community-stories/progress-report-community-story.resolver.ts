import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, type IdOf } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { PeriodicReportLoader } from '../../periodic-report';
import { type PeriodicReport } from '../../periodic-report/dto';
import {
  ChangePrompt,
  ChoosePrompt,
  CreatePromptWithExternalContent,
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
    @Args({ name: 'input' }) input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportCommunityStoryWithContent(
    @Args({ name: 'input' })
    input: CreatePromptWithExternalContent<CommunityStoryVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.createWithResponse(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportCommunityStoryPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportCommunityStoryResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<CommunityStoryVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportCommunityStory(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
