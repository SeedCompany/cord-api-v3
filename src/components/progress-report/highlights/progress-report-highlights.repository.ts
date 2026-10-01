import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportHighlight as Highlight } from '../dto/highlights.dto';

@Injectable()
export class ProgressReportHighlightsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'highlights'],
  Highlight,
) {}
