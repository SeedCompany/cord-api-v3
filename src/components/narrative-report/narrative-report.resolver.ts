import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { ResourceResolver } from '../../core';
import { LanguageEngagement } from '../engagement';
import { QuestionBankEntry } from '../question-answer/dto';
import { NarrativeReport } from './dto';
import { getBank } from './question-bank';

@Resolver(NarrativeReport)
export class NarrativeReportResolver {
  constructor(private readonly resources: ResourceResolver) {}

  @ResolveField(() => [QuestionBankEntry])
  async questionBank(
    @Parent() report: NarrativeReport,
    @LoggedInSession() session: Session
  ): Promise<readonly QuestionBankEntry[]> {
    // TODO use EngagementLoader whn available
    const parent = await this.resources.lookupByBaseNode(
      report.parent,
      session
    );
    const isLangEng = (obj: typeof parent): obj is LanguageEngagement =>
      parent.__typename === 'LanguageEngagement';
    if (!isLangEng(parent)) {
      return [];
    }
    return getBank().filter((entry) =>
      !entry.filter ? true : entry.filter({ report, eng: parent })
    );
  }
}
