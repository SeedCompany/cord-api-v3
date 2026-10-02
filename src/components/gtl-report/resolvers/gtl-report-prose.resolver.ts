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
import { type GtlProseVariant, GTLReport } from '../dto';
import { GtlReportCommunityImpactService } from '../prose/gtl-report-community-impact.service';
import { GtlReportHighlightService } from '../prose/gtl-report-highlight.service';

/**
 * The prompt-driven written sections of a GTL report: Community Impact and
 * Highlights. Each is a list of prompt responses with the four audience
 * variants, exactly as the Progress Report's sections are.
 */
@Resolver(GTLReport)
export class GtlReportProseResolver {
  constructor(
    private readonly communityImpactService: GtlReportCommunityImpactService,
    private readonly highlightService: GtlReportHighlightService,
  ) {}

  // ── Community Impact ─────────────────────────────────────────────────────

  @ResolveField(() => PromptVariantResponseList, {
    description:
      'Stories, testimonies and reflections on what Bible translation and the internship have meant around the leader',
  })
  async communityImpact(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.communityImpactService.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportCommunityImpact(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.communityImpactService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeGtlReportCommunityImpactPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.communityImpactService.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportCommunityImpactResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.communityImpactService.submitResponse(input);
  }

  @Mutation(() => GTLReport)
  async deleteGtlReportCommunityImpact(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.communityImpactService.delete(id);
    return await reports.load(response.parent.properties.id);
  }

  // ── Highlights ───────────────────────────────────────────────────────────

  @ResolveField(() => PromptVariantResponseList, {
    description: 'The high points of the quarter, in the leader’s own words',
  })
  async highlights(
    @Parent() report: GTLReport,
  ): Promise<PromptVariantResponseList<GtlProseVariant>> {
    return await this.highlightService.list(report);
  }

  @Mutation(() => PromptVariantResponse)
  async createGtlReportHighlight(
    @Args('input') input: ChoosePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.highlightService.create(input);
  }

  @Mutation(() => PromptVariantResponse)
  async changeGtlReportHighlightPrompt(
    @Args('input') input: ChangePrompt,
  ): Promise<PromptVariantResponse> {
    return await this.highlightService.changePrompt(input);
  }

  @Mutation(() => PromptVariantResponse)
  async updateGtlReportHighlightResponse(
    @Args('input') input: UpdatePromptVariantResponse<GtlProseVariant>,
  ): Promise<PromptVariantResponse> {
    return await this.highlightService.submitResponse(input);
  }

  @Mutation(() => GTLReport)
  async deleteGtlReportHighlight(
    @IdArg() id: ID<PromptVariantResponse>,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<PeriodicReport> {
    const response = await this.highlightService.delete(id);
    return await reports.load(response.parent.properties.id);
  }
}
