import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { firstLettersOfWords, ISession, Session } from '../../common';
import {
  EngagementListInput,
  SecuredInternshipEngagementList,
} from '../engagement/dto';
import { InternshipProject } from './dto';
import {
  ProjectMemberListInput,
  SecuredProjectMemberList,
} from './project-member';
import { ProjectService } from './project.service';

@Resolver(InternshipProject.classType)
export class InternshipProjectResolver {
  constructor(private readonly projects: ProjectService) {}

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() project: InternshipProject): string | undefined {
    return project.name.canRead && project.name.value
      ? firstLettersOfWords(project.name.value)
      : undefined;
  }

  @ResolveField(() => SecuredInternshipEngagementList)
  async engagements(
    @Parent() project: InternshipProject,
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => EngagementListInput,
      nullable: true,
      defaultValue: EngagementListInput.defaultVal,
    })
    input: EngagementListInput
  ): Promise<SecuredInternshipEngagementList> {
    return this.projects.listEngagements(project, input, session);
  }

  @ResolveField(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  async team(
    @Session() session: ISession,
    @Parent() { id }: InternshipProject,
    @Args({
      name: 'input',
      type: () => ProjectMemberListInput,
      defaultValue: ProjectMemberListInput.defaultVal,
    })
    input: ProjectMemberListInput
  ): Promise<SecuredProjectMemberList> {
    return this.projects.listProjectMembers(id, input, session);
  }
}
