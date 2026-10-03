import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportNextQuarterPlans as NextQuarterPlans } from '../dto/next-quarter-plans.dto';

@Injectable()
export class ProgressReportNextQuarterPlansRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'nextQuarterPlans'],
  NextQuarterPlans,
) {}
