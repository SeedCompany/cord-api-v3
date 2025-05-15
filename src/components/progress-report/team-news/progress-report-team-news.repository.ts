import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';
import { oncePerProjectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';

@Injectable()
export class ProgressReportTeamNewsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'teamNews'],
  TeamNews,
) {
  protected filterToReadable() {
    return this.privileges.filterToReadable({
      wrapContext: oncePerProjectFromProgressReportChild,
    });
  }
}
