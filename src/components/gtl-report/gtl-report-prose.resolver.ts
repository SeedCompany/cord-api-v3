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
import { GtlReportPetitionService } from './prose/gtl-report-petition.service';
import { GtlReportPraiseService } from './prose/gtl-report-praise.service';

/**
 * The narrative sections of a GTL report.
 *
 * Praises and petitions are separate resources rather than one "prayer"
 * resource with two prompts: praise-vs-petition is a kind, not an audience
 * variant, and PromptVariantResponse has no column for a kind. Two resources
 * also means two independent policy grants. The UI joins them into one Prayer
 * Requests panel.
 */
@Resolver(GTLReport)
export class GtlReportProseResolver {
  constructor(
    private readonly communityImpactService: GtlReportCommunityImpactService,
    private readonly praiseService: GtlReportPraiseService,
    private readonly petitionService: GtlReportPetitionService,
  ) {}

  @ResolveField(() => PromptVariantResponseList)
  async communityImpact(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.communityImpactService.list(report as any);
  }

  @ResolveField(() => PromptVariantResponseList)
  async praises(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.praiseService.list(report as any);
  }

  @ResolveField(() => PromptVariantResponseList)
  async petitions(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.petitionService.list(report as any);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportCommunityImpact(@Args('input') input: ChoosePrompt) {
    return await this.communityImpactService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportCommunityImpactResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ) {
    return await this.communityImpactService.submitResponse(input as never);
  }

  @Mutation(() => PromptVariantResponse)
  async changeGtlReportCommunityImpactPrompt(
    @Args('input') input: ChangePrompt,
  ) {
    return await this.communityImpactService.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportPraise(@Args('input') input: ChoosePrompt) {
    return await this.praiseService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportPraiseResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ) {
    return await this.praiseService.submitResponse(input as never);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportPetition(@Args('input') input: ChoosePrompt) {
    return await this.petitionService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportPetitionResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ) {
    return await this.petitionService.submitResponse(input as never);
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
