import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type GTLReport, type GtlReportHighlight } from '../dto';
import { highlightPrompts } from './gtl-prompts';
import { GtlReportHighlightRepository } from './gtl-report-highlight.repository';

@Injectable()
export class GtlReportHighlightService extends PromptVariantResponseListService(
  GtlReportHighlightRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return highlightPrompts;
  }

  // See GtlReportCommunityImpactService.getPrivilegeContext.
  protected async getPrivilegeContext(dto: UnsecuredDto<GtlReportHighlight>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as GTLReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
