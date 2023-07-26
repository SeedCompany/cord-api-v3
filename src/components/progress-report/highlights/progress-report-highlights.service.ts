import { Injectable } from '@nestjs/common';
import { UnsecuredDto } from '~/common';
import {
  withEffectiveSensitivity,
  withScope,
} from '../../authorization/policies/conditions';
import { Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { ProgressReport } from '../dto';
import { ProgressReportHighlight as Highlight } from '../dto/highlights.dto';
import { ProgressReportHighlightsRepository } from './progress-report-highlights.repository';

@Injectable()
export class ProgressReportHighlightsService extends PromptVariantResponseListService(
  ProgressReportHighlightsRepository,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return prompts;
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

const prompts = [
  Prompt.create({
    id: 'B3HOymZDiwi',
    text: 'What are the biggest obstacles team members are facing in reaching their goals? How are they dealing with those obstacles? (Ex: translation difficulties, political unrest, suppression of faith)',
  }),
  Prompt.create({
    id: '3rLRHtQKsyy',
    text: 'What terms or concepts were difficult to find the right word for in the local language? Please explain how you found a solution.',
  }),
  Prompt.create({
    id: 'zsuBZUOwy3b',
    text: 'How has working on the translation affected team members or their families? Please give a specific example.',
  }),
  Prompt.create({
    id: '1uzkzNwBRk3',
    text: 'What are the biggest obstacles team members are facing in reaching their goals? How are they dealing with those obstacles? (Ex: translation difficulties, political unrest, suppression of faith)',
  }),
];
