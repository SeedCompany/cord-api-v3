import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { ProgressReport } from '../dto';
import { ProgressReportHighlight as Highlight } from '../dto/highlights.dto';

@Injectable()
export class ProgressReportHighlightsDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [ProgressReport, 'highlights'],
  Highlight,
) {}
