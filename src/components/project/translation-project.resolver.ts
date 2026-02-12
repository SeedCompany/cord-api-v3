import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { EngagementLoader } from '../engagement';
import {
  EngagementListInput,
  type SecuredEngagementList,
  SecuredLanguageEngagementList,
} from '../engagement/dto';
import { type Project, TranslationProject } from './dto';
import { ProjectService } from './project.service';

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
