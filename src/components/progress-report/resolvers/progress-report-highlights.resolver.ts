import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, LoggedInSession, Session } from '~/common';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { HighlightVariant } from '../dto/hightlights.dto';
import { ProgressReportHighlightsService } from '../progress-report-highlights.service';

@Resolver(ProgressReport)
export class ProgressReportHighlightsResolver {
  constructor(private readonly service: ProgressReportHighlightsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async highlights(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<PromptVariantResponseList<HighlightVariant>> {
    return await this.service.list(report, session);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportHighlight(
    @Args({ name: 'input' }) input: ChoosePrompt,
    @LoggedInSession() session: Session
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportHighlightPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
    @LoggedInSession() session: Session
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input, session);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportHighlightResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<HighlightVariant>,
    @LoggedInSession() session: Session
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input, session);
  }
}
