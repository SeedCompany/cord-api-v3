import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import { type ProgressReportNextQuarterPlans as NextQuarterPlans } from '../dto/next-quarter-plans.dto';
import { prompts } from './next-quarter-plans-prompts';
import { ProgressReportNextQuarterPlansRepository } from './progress-report-next-quarter-plans.repository';

@Injectable()
export class ProgressReportNextQuarterPlansService extends PromptVariantResponseListService(
  ProgressReportNextQuarterPlansRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<NextQuarterPlans>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
