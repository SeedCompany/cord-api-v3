import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
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
import { type NextQuarterPlansVariant } from '../dto/next-quarter-plans.dto';
import { ProgressReportNextQuarterPlansService } from './progress-report-next-quarter-plans.service';

@Resolver(ProgressReport)
export class ProgressReportNextQuarterPlansResolver {
  constructor(
    private readonly service: ProgressReportNextQuarterPlansService,
  ) {}

  @ResolveField(() => PromptVariantResponseList)
  async nextQuarterPlans(
    @Parent() report: ProgressReport,
  ): Promise<PromptVariantResponseList<NextQuarterPlansVariant>> {
    return await this.service.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportNextQuarterPlans(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportNextQuarterPlansPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportNextQuarterPlansResponse(
    @Args('input') input: UpdatePromptVariantResponse<NextQuarterPlansVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportNextQuarterPlans(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
