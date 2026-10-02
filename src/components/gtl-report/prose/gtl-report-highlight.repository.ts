import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { GTLReport, GtlReportHighlight } from '../dto';

@Injectable()
export class GtlReportHighlightRepository extends PromptVariantResponseRepository(
  [GTLReport, 'highlights'],
  GtlReportHighlight,
) {}
