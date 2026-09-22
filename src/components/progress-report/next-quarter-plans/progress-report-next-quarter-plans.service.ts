import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
// Type-only: names the contract the service factory expects. Erased at compile
// time, so nothing Neo4j is imported at runtime.
import { type PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import {
  type ProgressReportNextQuarterPlans,
  type ProgressReportNextQuarterPlans as Response,
} from '../dto/next-quarter-plans.dto';
import { prompts } from './next-quarter-plans-prompts';
import { ProgressReportNextQuarterPlansDrizzleRepository } from './progress-report-next-quarter-plans.drizzle.repository';

@Injectable()
export class ProgressReportNextQuarterPlansService extends PromptVariantResponseListService(
  // The service factory is typed against the repository factory's return type,
  // which the Drizzle repository is the declared mirror of. Cast to that exact
  // type rather than `any` — `any` erases the variant generic and every
  // mutation input downstream collapses to `never`.
  ProgressReportNextQuarterPlansDrizzleRepository as unknown as ReturnType<
    typeof PromptVariantResponseRepository<
      typeof ProgressReport,
      typeof ProgressReportNextQuarterPlans
    >
  >,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<Response>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
