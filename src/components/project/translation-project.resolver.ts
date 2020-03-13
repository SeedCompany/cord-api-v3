import { Args, Parent, ResolveProperty, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../auth';
import {
  EngagementListInput,
  SecuredLanguageEngagementList,
} from '../engagement/dto';
import { TranslationProject } from './dto';
import { ProjectService } from './project.service';

@Resolver(TranslationProject.classType)
export class TranslationProjectResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveProperty(() => SecuredLanguageEngagementList)
  async engagements(
    @Parent() project: TranslationProject,
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => EngagementListInput,
      nullable: true,
      defaultValue: EngagementListInput.defaultVal,
    })
    input: EngagementListInput
  ): Promise<SecuredLanguageEngagementList> {
    return this.projects.listEngagements(project, input, session);
  }
}
