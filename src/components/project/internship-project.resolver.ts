import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { EngagementLoader } from '../engagement';
import {
  EngagementListInput,
  type SecuredEngagementList,
  SecuredInternshipEngagementList,
} from '../engagement/dto';
import { InternshipProject, type Project } from './dto';
import { ProjectService } from './project.service';

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
    @Parent() project: Project,
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<SecuredEngagementList> {
    const list = await this.projects.listEngagements(
      project,
      input,
      project.changeset ? { changeset: project.changeset } : { active: true },
    );
    engagements.primeAll(list.items);
    return list;
  }
}
