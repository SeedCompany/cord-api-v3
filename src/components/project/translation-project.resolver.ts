import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ListArg, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  EngagementListInput,
  SecuredEngagementList,
  SecuredLanguageEngagementList,
} from '../engagement/dto';
import { EngagementLoader } from '../engagement/engagement.loader';
import { Project, ProjectService, TranslationProject } from './index';

@Resolver(TranslationProject)
export class TranslationProjectResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveField(() => SecuredLanguageEngagementList, {
    description: stripIndent`
      Same as \`engagements\` field just typed as a list of concrete LanguageEngagements instead of the interface.
      TranslationProjects will only have LanguageEngagements.
    `,
  })
  async languageEngagements(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ): Promise<SecuredEngagementList> {
    const list = await this.projects.listEngagements(
      project,
      input,
      session,
      project.changeset ? { changeset: project.changeset } : { active: true }
    );
    engagements.primeAll(list.items);
    return list;
  }
}
