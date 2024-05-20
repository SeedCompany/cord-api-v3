import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, IdArg, IdOf, LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { PeriodicReportLoader } from '../../periodic-report';
import { PeriodicReport } from '../../periodic-report/dto';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { TeamNewsVariant } from '../dto/team-news.dto';
import { ProgressReportTeamNewsService } from './progress-report-team-news.service';

@Resolver(ProgressReport)
export class ProgressReportTeamNewsResolver {
  constructor(private readonly service: ProgressReportTeamNewsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async teamNews(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session,
  ): Promise<PromptVariantResponseList<TeamNewsVariant>> {
    return await this.service.list(report, session);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportTeamNews(
    @Args({ name: 'input' }) input: ChoosePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportTeamNewsPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportTeamNewsResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<TeamNewsVariant>,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input, session);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportTeamNews(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @LoggedInSession() session: Session,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id, session);
    return await reports.load(response.parent.properties.id);
  }
}
