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
import { HighlightVariant } from '../dto/hightlights.dto';
import { ProgressReportHighlightsService } from './progress-report-highlights.service';

@Resolver(ProgressReport)
export class ProgressReportHighlightsResolver {
  constructor(private readonly service: ProgressReportHighlightsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async highlights(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session,
  ): Promise<PromptVariantResponseList<HighlightVariant>> {
    return await this.service.list(report, session);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportHighlight(
    @Args({ name: 'input' }) input: ChoosePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportHighlightPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportHighlightResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<HighlightVariant>,
    @LoggedInSession() session: Session,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input, session);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportHighlight(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @LoggedInSession() session: Session,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id, session);
    return await reports.load(response.parent.properties.id);
  }
}
