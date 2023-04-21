import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../../common';
import { Loader, LoaderOf } from '../../../core';
import { ProjectMemberLoader, ProjectMemberService } from '../project-member';
import {
  CreateProjectMemberInput,
  CreateProjectMemberOutput,
  DeleteProjectMemberOutput,
  ProjectMember,
  ProjectMemberListInput,
  ProjectMemberListOutput,
  UpdateProjectMemberInput,
  UpdateProjectMemberOutput,
} from './dto';

@Resolver()
export class ProjectMemberResolver {
  constructor(private readonly service: ProjectMemberService) {}

  @Mutation(() => CreateProjectMemberOutput, {
    description: 'Create a project member',
  })
  async createProjectMember(
    @LoggedInSession() session: Session,
    @Args('input') { projectMember: input }: CreateProjectMemberInput,
  ): Promise<CreateProjectMemberOutput> {
    const projectMember = await this.service.create(input, session);
    return { projectMember };
  }

  @Query(() => ProjectMember, {
    description: 'Look up a project member by ID',
  })
  async projectMember(
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>,
    @IdArg() id: ID,
  ): Promise<ProjectMember> {
    return await projectMembers.load(id);
  }

  @Query(() => ProjectMemberListOutput, {
    description: 'Look up project members',
  })
  async projectMembers(
    @AnonSession() session: Session,
    @ListArg(ProjectMemberListInput) input: ProjectMemberListInput,
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>,
  ): Promise<ProjectMemberListOutput> {
    const list = await this.service.list(input, session);
    projectMembers.primeAll(list.items);
    return list;
  }

  @Mutation(() => UpdateProjectMemberOutput, {
    description: 'Update a project member',
  })
  async updateProjectMember(
    @LoggedInSession() session: Session,
    @Args('input') { projectMember: input }: UpdateProjectMemberInput,
  ): Promise<UpdateProjectMemberOutput> {
    const projectMember = await this.service.update(input, session);
    return { projectMember };
  }

  @Mutation(() => Boolean, {
    description:
      'Swap out the oldProjectMember with newProjectMember in all projects that oldProjectMember is associated with.',
  })
  async swapProjectMember(
    @LoggedInSession() session: Session,
    @IdArg({ name: 'oldMemberId' }) oldMemberId: ID,
    @IdArg({ name: 'newMemberId' }) newMemberId: ID,
  ): Promise<boolean> {
    await this.service.swapMembers(session, oldMemberId, newMemberId);
    return true;
  }

  @Mutation(() => DeleteProjectMemberOutput, {
    description: 'Delete a project member',
  })
  async deleteProjectMember(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteProjectMemberOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }
}
