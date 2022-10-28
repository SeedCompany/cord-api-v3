import { Injectable } from '@nestjs/common';
import { SecuredList, SecuredListType, Session } from '~/common';
import { Role } from '../authorization';
import {
  Prompt,
  PromptVariantResponse,
  VariantPromptList,
} from '../prompts/dto';
import { ProgressReport } from './dto';

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
    return available;
  }
}

const available: VariantPromptList = {
  variants: [
    {
      key: 'draft',
      label: `Partner's Entry`,
      responsibleRole: Role.FieldPartner,
    },
    {
      key: 'translated',
      label: `Translation`,
      responsibleRole: Role.Translator,
    },
    {
      key: 'fpm',
      label: `Field Project Manager Notes`,
      responsibleRole: Role.ProjectManager,
    },
    {
      key: 'published',
      label: `Published Version`,
      responsibleRole: Role.Marketing,
    },
  ],
  prompts: [
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
  ],
};
