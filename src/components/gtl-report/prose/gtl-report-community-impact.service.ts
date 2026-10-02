import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type GTLReport, type GtlReportCommunityImpact } from '../dto';
import { communityImpactPrompts } from './gtl-prompts';
import { GtlReportCommunityImpactRepository } from './gtl-report-community-impact.repository';

@Injectable()
export class GtlReportCommunityImpactService extends PromptVariantResponseListService(
  GtlReportCommunityImpactRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return communityImpactPrompts;
  }

  // The response row carries only its parent's id; the report is what the
  // member and sensitivity conditions need to read, so load it and hand over
  // exactly those two properties — the same shape Momentum's sections use.
  protected async getPrivilegeContext(
    dto: UnsecuredDto<GtlReportCommunityImpact>,
  ) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as GTLReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
