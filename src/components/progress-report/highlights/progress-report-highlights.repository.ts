import { Injectable } from '@nestjs/common';
import { type Session } from '~/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportHighlight as Highlight } from '../dto/highlights.dto';
import { oncePerProjectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';

@Injectable()
export class ProgressReportHighlightsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'highlights'],
  Highlight,
) {
  protected filterToReadable(session: Session) {
    return this.privileges.forUser(session).filterToReadable({
      wrapContext: oncePerProjectFromProgressReportChild,
    });
  }
}
