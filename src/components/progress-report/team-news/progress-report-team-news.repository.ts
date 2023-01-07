import { Injectable } from '@nestjs/common';
import { Session } from '~/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';
import { oncePerProjectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';

@Injectable()
export class ProgressReportTeamNewsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'teamNews'],
  TeamNews
) {
  protected filterToReadable(session: Session) {
    return this.privileges.forUser(session).filterToReadable({
      wrapContext: oncePerProjectFromProgressReportChild,
    });
  }
}
