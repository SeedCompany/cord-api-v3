import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { GTLReport, GtlReportCommunityImpact } from '../dto';

@Injectable()
export class GtlReportCommunityImpactRepository extends PromptVariantResponseRepository(
  [GTLReport, 'communityImpact'],
  GtlReportCommunityImpact,
) {}
