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
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { type TeamNewsVariant } from '../dto/team-news.dto';
import { ProgressReportTeamNewsService } from './progress-report-team-news.service';

@Resolver(ProgressReport)
export class ProgressReportTeamNewsResolver {
  constructor(private readonly service: ProgressReportTeamNewsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async teamNews(
    @Parent() report: ProgressReport,
  ): Promise<PromptVariantResponseList<TeamNewsVariant>> {
    return await this.service.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportTeamNews(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportTeamNewsPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportTeamNewsResponse(
    @Args('input')
    input: UpdatePromptVariantResponse<TeamNewsVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportTeamNews(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
