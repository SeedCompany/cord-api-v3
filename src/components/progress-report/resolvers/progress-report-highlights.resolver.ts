import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, Session } from '~/common';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { ProgressReportHighlightsService } from '../progress-report-highlights.service';

@Resolver(ProgressReport)
export class ProgressReportHighlightsResolver {
  constructor(private readonly service: ProgressReportHighlightsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async highlights(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<PromptVariantResponseList> {
    const [list, available] = await Promise.all([
      this.service.list(report, session),
      this.service.getAvailable(session),
    ]);
    return { ...list, available };
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportHighlight(
    @Args({ name: 'input' }) input: ChoosePrompt
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportHighlightPrompt(
    @Args({ name: 'input' }) input: ChangePrompt
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportHighlightResponse(
    @Args({ name: 'input' }) input: UpdatePromptVariantResponse
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }
}
