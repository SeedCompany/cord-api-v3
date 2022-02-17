import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ListArg, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  EngagementListInput,
  SecuredEngagementList,
  SecuredInternshipEngagementList,
} from '../engagement/dto';
import { EngagementLoader } from '../engagement/engagement.loader';
import { InternshipProject, Project, ProjectService } from './index';

@Resolver(InternshipProject)
export class InternshipProjectResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveField(() => SecuredInternshipEngagementList, {
    description: stripIndent`
      Same as \`engagements\` field just typed as a list of concrete InternshipEngagements instead of the interface.
      InternshipProjects will only have InternshipEngagements.
    `,
  })
  async internshipEngagements(
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
