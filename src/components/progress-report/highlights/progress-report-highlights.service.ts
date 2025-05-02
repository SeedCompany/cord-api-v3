import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type ProgressReport } from '../dto';
import { type ProgressReportHighlight as Highlight } from '../dto/highlights.dto';
import { ProgressReportHighlightsRepository } from './progress-report-highlights.repository';

@Injectable()
export class ProgressReportHighlightsService extends PromptVariantResponseListService(
  ProgressReportHighlightsRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return [];
  }

  protected async getPrivilegeContext(dto: UnsecuredDto<Highlight>) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as ProgressReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}
