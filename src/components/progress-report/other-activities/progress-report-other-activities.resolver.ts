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
import { type OtherActivitiesVariant } from '../dto/other-activities.dto';
import { ProgressReportOtherActivitiesService } from './progress-report-other-activities.service';

@Resolver(ProgressReport)
export class ProgressReportOtherActivitiesResolver {
  constructor(private readonly service: ProgressReportOtherActivitiesService) {}

  @ResolveField(() => PromptVariantResponseList)
  async otherActivities(
    @Parent() report: ProgressReport,
  ): Promise<PromptVariantResponseList<OtherActivitiesVariant>> {
    return await this.service.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createProgressReportOtherActivities(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeProgressReportOtherActivitiesPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.service.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateProgressReportOtherActivitiesResponse(
    @Args('input') input: UpdatePromptVariantResponse<OtherActivitiesVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.service.submitResponse(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportOtherActivities(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.service.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
