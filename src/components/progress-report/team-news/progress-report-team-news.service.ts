import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import { type ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';
import { ProgressReportTeamNewsRepository } from './progress-report-team-news.repository';
import { prompts } from './team-news-prompts';

@Injectable()
export class ProgressReportTeamNewsService extends PromptVariantResponseListService(
  ProgressReportTeamNewsRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<TeamNews>) {
    const report = (await this.resources.loadByBaseNode(dto.parent)) as ProgressReport;
    return withEffectiveSensitivity(withScope({}, report.scope), report.sensitivity);
  }
}
