import { Injectable } from '@nestjs/common';
import { UnsecuredDto } from '~/common';
import {
  withEffectiveSensitivity,
  withScope,
} from '../../authorization/policies/conditions';
import { Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { ProgressReport } from '../dto';
import { ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';
import { ProgressReportTeamNewsRepository } from './progress-report-team-news.repository';

@Injectable()
export class ProgressReportTeamNewsService extends PromptVariantResponseListService(
  ProgressReportTeamNewsRepository
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<TeamNews>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity
    );
  }
}

const prompts = [
  Prompt.create({
    id: 'F4eY7VXhPpM',
    text: 'News?',
  }),
];
