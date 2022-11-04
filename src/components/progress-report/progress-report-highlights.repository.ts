import { Injectable } from '@nestjs/common';
import { IdOf, PaginatedListType, Session, TODO, UnsecuredDto } from '~/common';
import { ChoosePrompt, UpdatePromptVariantResponse } from '../prompts/dto';
import { PromptVariantResponseRepository } from '../prompts/prompt-variant-response.repository';
import { ProgressReport } from './dto';
import {
  ProgressReportHighlight as Highlight,
  HighlightVariant,
} from './dto/hightlights.dto';

@Injectable()
export class ProgressReportHighlightsRepository extends PromptVariantResponseRepository<HighlightVariant> {
  async list(
    reportId: IdOf<ProgressReport>,
    session: Session
  ): Promise<PaginatedListType<UnsecuredDto<Highlight>>> {
    return TODO(reportId, session);
  }

  async create(
    input: ChoosePrompt,
    session: Session
  ): Promise<UnsecuredDto<Highlight>> {
    return TODO(input, session);
  }

  async submitResponse(
    input: UpdatePromptVariantResponse<HighlightVariant>,
    session: Session
  ) {
    return TODO(input, session);
  }
}
