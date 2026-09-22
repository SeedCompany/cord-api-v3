import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { ProgressReport } from '../dto';
import { ProgressReportNextQuarterPlans } from '../dto/next-quarter-plans.dto';

/**
 * Drizzle only — there is no Neo4j counterpart and none is wanted.
 *
 * Needs no migration: every PromptVariantResponse subtype shares the
 * prompt_variant_responses/_entries table pair, scoped by `resource_type`.
 */
@Injectable()
export class ProgressReportNextQuarterPlansDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [ProgressReport, 'nextQuarterPlans'],
  ProgressReportNextQuarterPlans,
) {}
