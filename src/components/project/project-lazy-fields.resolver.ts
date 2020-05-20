import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Class } from 'type-fest';
import { firstLettersOfWords, ISession, Session } from '../../common';
import { EngagementListInput, SecuredEngagementList } from '../engagement';
import { InternshipProject, Project, TranslationProject } from './dto';
import {
  ProjectMemberListInput,
  SecuredProjectMemberList,
} from './project-member/dto';
import { ProjectService } from './project.service';

export class TranslationProjectResolver extends ConcreteProjectResolver(
  TranslationProject.classType
) {}

export class InternshipProjectResolver extends ConcreteProjectResolver(
  InternshipProject.classType
) {}

function ConcreteProjectResolver<T>(concreteClass: Class<T>) {
  @Resolver(concreteClass)
  class ProjectResolver {
    constructor(private readonly projectService: ProjectService) {}

    @ResolveField(() => String, { nullable: true })
    avatarLetters(@Parent() project: Project): string | undefined {
      return project.name.canRead && project.name.value
        ? firstLettersOfWords(project.name.value)
        : undefined;
    }

    @ResolveField(() => SecuredEngagementList)
    async engagements(
      @Session() session: ISession,
      @Parent() project: Project,
      @Args({
        name: 'input',
        type: () => EngagementListInput,
        nullable: true,
        defaultValue: EngagementListInput.defaultVal,
      })
      input: EngagementListInput
    ): Promise<SecuredEngagementList> {
      return this.projectService.listEngagements(project, input, session);
    }

    @ResolveField(() => SecuredProjectMemberList, {
      description: 'The project members',
    })
    async team(
      @Session() session: ISession,
      @Parent() { id }: Project,
      @Args({
        name: 'input',
        type: () => ProjectMemberListInput,
        defaultValue: ProjectMemberListInput.defaultVal,
      })
      input: ProjectMemberListInput
    ): Promise<SecuredProjectMemberList> {
      return this.projectService.listProjectMembers(id, input, session);
    }
  }
  return ProjectResolver;
}
