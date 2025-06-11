import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
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
import { type HighlightVariant } from '../dto/highlights.dto';
import { ProgressReportHighlightsService } from './progress-report-highlights.service';

@Resolver(ProgressReport)
export class ProgressReportHighlightsResolver {
  constructor(private readonly service: ProgressReportHighlightsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async highlights(
    @Parent() report: ProgressReport,
  ): Promise<PromptVariantResponseList<HighlightVariant>> {
    return await this.service.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportHighlight(
    @Args({ name: 'input' }) input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportHighlightPrompt(
    @Args({ name: 'input' }) input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportHighlightResponse(
    @Args({ name: 'input' })
    input: UpdatePromptVariantResponse<HighlightVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportHighlight(
    @IdArg() id: IdOf<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
