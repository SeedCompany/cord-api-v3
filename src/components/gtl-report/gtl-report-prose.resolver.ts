import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PeriodicReportLoader } from '../periodic-report';
import { type PeriodicReport } from '../periodic-report/dto';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from '../prompts/dto';
import { type GtlProseVariant, GTLReport } from './dto';
import { GtlReportCommunityImpactService } from './prose/gtl-report-community-impact.service';

/**
 * The narrative sections of a GTL report.
 *
 * Community impact is the only prompt-driven section. Prayer used to be two
 * more of these; it is now Posts on the engagement, with the report carried
 * as an attribution — @see InternshipEngagement's Postable declaration.
 */
@Resolver(GTLReport)
export class GtlReportProseResolver {
  constructor(
    private readonly communityImpactService: GtlReportCommunityImpactService,
  ) {}

  @ResolveField(() => PromptVariantResponseList)
  async communityImpact(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.communityImpactService.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportCommunityImpact(@Args('input') input: ChoosePrompt) {
    return await this.communityImpactService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportCommunityImpactResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ) {
    return await this.communityImpactService.submitResponse(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeGtlReportCommunityImpactPrompt(
    @Args('input') input: ChangePrompt,
  ) {
    return await this.communityImpactService.changePrompt(input);
  }

  @Mutation(() => GTLReport)
  async deleteGtlReportCommunityImpact(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.communityImpactService.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
