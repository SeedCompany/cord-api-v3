import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Class } from 'type-fest';
import { firstLettersOfWords, ISession, Session } from '../../common';
import { SecuredBudget } from '../budget';
import { EngagementListInput, SecuredEngagementList } from '../engagement';
import { PartnershipListInput, SecuredPartnershipList } from '../partnership';
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

    @ResolveField(() => SecuredBudget, {
      description: `The project's current budget`,
    })
    async budget(
      @Parent() project: Project,
      @Session() session: ISession
    ): Promise<SecuredBudget> {
      return this.projectService.currentBudget(project, session);
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

    @ResolveField(() => SecuredPartnershipList)
    async partnerships(
      @Session() session: ISession,
      @Parent() { id }: Project,
      @Args({
        name: 'input',
        type: () => PartnershipListInput,
        defaultValue: PartnershipListInput.defaultVal,
      })
      input: PartnershipListInput
    ): Promise<SecuredPartnershipList> {
      return this.projectService.listPartnerships(id, input, session);
    }
  }
  return ProjectResolver;
}
