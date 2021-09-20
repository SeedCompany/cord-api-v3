import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  LoggedInSession,
  Session,
} from '../../../common';
import {
  CreateProjectMemberInput,
  CreateProjectMemberOutput,
  ProjectMember,
  ProjectMemberListInput,
  ProjectMemberListOutput,
  UpdateProjectMemberInput,
  UpdateProjectMemberOutput,
} from './dto';
import { ProjectMemberService } from './project-member.service';

@Resolver()
export class ProjectMemberResolver {
  constructor(private readonly service: ProjectMemberService) {}

  @Mutation(() => CreateProjectMemberOutput, {
    description: 'Create a project member',
  })
  async createProjectMember(
    @LoggedInSession() session: Session,
    @Args('input') { projectMember: input }: CreateProjectMemberInput
  ): Promise<CreateProjectMemberOutput> {
    const projectMember = await this.service.create(input, session);
    return { projectMember };
  }

  @Query(() => ProjectMember, {
    description: 'Look up a project member by ID',
  })
  async projectMember(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<ProjectMember> {
    return await this.service.readOne(id, session);
  }

  @Query(() => ProjectMemberListOutput, {
    description: 'Look up project members',
  })
  async projectMembers(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => ProjectMemberListInput,
      defaultValue: ProjectMemberListInput.defaultVal,
    })
    input: ProjectMemberListInput
  ): Promise<ProjectMemberListOutput> {
    return await this.service.list(input, session);
  }

  @Mutation(() => UpdateProjectMemberOutput, {
    description: 'Update a project member',
  })
  async updateProjectMember(
    @LoggedInSession() session: Session,
    @Args('input') { projectMember: input }: UpdateProjectMemberInput
  ): Promise<UpdateProjectMemberOutput> {
    const projectMember = await this.service.update(input, session);
    return { projectMember };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project member',
  })
  async deleteProjectMember(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
