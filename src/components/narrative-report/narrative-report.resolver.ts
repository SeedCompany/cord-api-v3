import { Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import { ResourceResolver } from '../../core';
import { LanguageEngagement } from '../engagement';
import {
  QuestionAnswerService,
  QuestionBank,
  SecuredQuestionAnswerList,
} from '../question-answer';
import { NarrativeReport } from './dto';
import { NarrativeReportService } from './narrative-report.service';
import { getBank } from './question-bank';

@Resolver(NarrativeReport)
export class NarrativeReportResolver {
  constructor(
    private readonly service: NarrativeReportService,
    private readonly qa: QuestionAnswerService,
    private readonly resources: ResourceResolver
  ) {}

  @ResolveField(() => SecuredQuestionAnswerList)
  async questions(
    @Parent() report: NarrativeReport,
    @LoggedInSession() session: Session
  ): Promise<SecuredQuestionAnswerList> {
    const list = await this.qa.list(report.id, session);
    const perms = await this.service.getQuestionPerms(report, session);
    return {
      ...list,
      ...perms,
      items: list.items.map(perms.secure),
    };
  }

  @ResolveField(() => QuestionBank)
  async questionBank(
    @Parent() report: NarrativeReport,
    @LoggedInSession() session: Session
  ): Promise<QuestionBank> {
    // TODO use EngagementLoader whn available
    const parent = await this.resources.lookupByBaseNode(
      report.parent,
      session
    );
    const isLangEng = (obj: typeof parent): obj is LanguageEngagement =>
      parent.__typename === 'LanguageEngagement';
    if (!isLangEng(parent)) {
      return { categories: [] };
    }
    return getBank({ report, eng: parent });
  }

  @Mutation(() => NarrativeReport)
  async advanceNarrativeReportStatus(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<NarrativeReport> {
    await this.service.advanceStatus(id, session);
    return await this.resources.lookup(NarrativeReport, id, session);
  }
}
