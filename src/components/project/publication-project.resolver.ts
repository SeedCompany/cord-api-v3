import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ListArg, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  EngagementListInput,
  SecuredEngagementList,
  SecuredPublicationEngagementList,
} from '../engagement/dto';
import { EngagementLoader } from '../engagement/engagement.loader';
import { Project, ProjectService, PublicationProject } from './index';

@Resolver(PublicationProject)
export class PublicationProjectResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveField(() => SecuredPublicationEngagementList, {
    description: stripIndent`
    Same as \`engagements\` field just typed as a list of concrete PublicationEngagements instead of the interface.
      PublicattionProjects will only have PublicationEngagements.
    `,
  })
  async publicationEngagement(
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
