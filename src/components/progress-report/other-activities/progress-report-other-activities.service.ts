import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import { type ProgressReportOtherActivities as OtherActivities } from '../dto/other-activities.dto';
import { prompts } from './other-activities-prompts';
import { ProgressReportOtherActivitiesRepository } from './progress-report-other-activities.repository';

@Injectable()
export class ProgressReportOtherActivitiesService extends PromptVariantResponseListService(
  ProgressReportOtherActivitiesRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<OtherActivities>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
