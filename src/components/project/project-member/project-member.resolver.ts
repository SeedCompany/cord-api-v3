import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { ProjectMemberService } from '../project-member';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberCreated,
  ProjectMemberDeleted,
  ProjectMemberUpdated,
  UpdateProjectMember,
} from './dto';

@Resolver(ProjectMember)
export class ProjectMemberResolver {
  constructor(private readonly service: ProjectMemberService) {}

  @ResolveField(() => Boolean, {
    nullable: true,
  })
  active(@Parent() member: ProjectMember): boolean | null {
    return member.inactiveAt.canRead ? !member.inactiveAt.value : null;
  }

  @Mutation(() => ProjectMemberCreated, {
    description: 'Create a project member',
  })
  async createProjectMember(
    @Args('input') input: CreateProjectMember,
  ): Promise<ProjectMemberCreated> {
    const projectMember = await this.service.create(input);
    return { projectMember };
  }

  @Mutation(() => ProjectMemberUpdated, {
    description: 'Update a project member',
  })
  async updateProjectMember(
    @Args('input') input: UpdateProjectMember,
  ): Promise<ProjectMemberUpdated> {
    const projectMember = await this.service.update(input);
    return { projectMember };
  }

  @Mutation(() => ProjectMemberDeleted, {
    description: 'Delete a project member',
  })
  async deleteProjectMember(@IdArg() id: ID): Promise<ProjectMemberDeleted> {
    await this.service.delete(id);
    return {};
  }
}
