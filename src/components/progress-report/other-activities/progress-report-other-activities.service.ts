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
  type ProgressReportOtherActivities,
  type ProgressReportOtherActivities as Response,
} from '../dto/other-activities.dto';
import { prompts } from './other-activities-prompts';
import { ProgressReportOtherActivitiesDrizzleRepository } from './progress-report-other-activities.drizzle.repository';

@Injectable()
export class ProgressReportOtherActivitiesService extends PromptVariantResponseListService(
  // The service factory is typed against the repository factory's return type,
  // which the Drizzle repository is the declared mirror of. Cast to that exact
  // type rather than `any` — `any` erases the variant generic and every
  // mutation input downstream collapses to `never`.
  ProgressReportOtherActivitiesDrizzleRepository as unknown as ReturnType<
    typeof PromptVariantResponseRepository<
      typeof ProgressReport,
      typeof ProgressReportOtherActivities
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
