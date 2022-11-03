import { Injectable } from '@nestjs/common';
import { SecuredList, SecuredListType, Session, TODO } from '~/common';
import {
  ChangePrompt,
  ChoosePrompt,
  Prompt,
  PromptVariantResponse,
  UpdatePromptVariantResponse,
  VariantPromptList,
} from '../prompts/dto';
import { ProgressReport } from './dto';
import { ProgressReportHighlight as Highlights } from './dto/hightlights.dto';

@Injectable()
export class ProgressReportHighlightsService {
  async list(
    _report: ProgressReport,
    _session: Session
  ): Promise<SecuredListType<PromptVariantResponse>> {
    return SecuredList.Redacted;
  }

  async getAvailable(_session: Session): Promise<VariantPromptList> {
    // TODO filter variants to readable
    return {
      prompts,
      variants: Highlights.Variants,
    };
  }

  async create(input: ChoosePrompt): Promise<PromptVariantResponse> {
    return TODO(input);
  }

  async changePrompt(input: ChangePrompt): Promise<PromptVariantResponse> {
    return TODO(input);
  }

  async submitResponse(
    input: UpdatePromptVariantResponse
  ): Promise<PromptVariantResponse> {
    return TODO(input);
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
