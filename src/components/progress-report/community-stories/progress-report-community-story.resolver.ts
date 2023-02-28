import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, IdArg, IdOf, LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { PeriodicReport, PeriodicReportLoader } from '../../periodic-report';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { CommunityStoryVariant } from '../dto/community-stories.dto';
import { ProgressReportCommunityStoryService } from './progress-report-community-story.service';

@Resolver(ProgressReport)
export class ProgressReportCommunityStoryResolver {
  constructor(private readonly service: ProgressReportCommunityStoryService) {}

  @ResolveField(() => PromptVariantResponseList)
  async communityStories(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session,
  ): Promise<PromptVariantResponseList<CommunityStoryVariant>> {
    return await this.service.list(report, session);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportCommunityStory(
    @Args({ name: 'input' }) input: ChoosePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportCommunityStoryPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportCommunityStoryResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<CommunityStoryVariant>,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input, session);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportCommunityStory(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @LoggedInSession() session: Session,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id, session);
    return await reports.load(response.parent.properties.id);
  }
}
