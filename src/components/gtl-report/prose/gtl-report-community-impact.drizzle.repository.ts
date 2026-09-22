import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { GTLReport, GtlReportCommunityImpact } from '../dto';

@Injectable()
export class GtlReportCommunityImpactDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [GTLReport, 'communityImpact'],
  GtlReportCommunityImpact,
) {}
