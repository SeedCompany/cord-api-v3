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
  CreateProjectMemberInput,
  CreateProjectMemberOutput,
  DeleteProjectMemberOutput,
  ProjectMember,
  UpdateProjectMemberInput,
  UpdateProjectMemberOutput,
} from './dto';

@Resolver(ProjectMember)
export class ProjectMemberResolver {
  constructor(private readonly service: ProjectMemberService) {}

  @ResolveField(() => Boolean, {
    nullable: true,
  })
  active(@Parent() member: ProjectMember): boolean | null {
    return !member.inactiveAt.canRead ? !member.inactiveAt.value : null;
  }

  @Mutation(() => CreateProjectMemberOutput, {
    description: 'Create a project member',
  })
  async createProjectMember(
    @Args('input') { projectMember: input }: CreateProjectMemberInput,
  ): Promise<CreateProjectMemberOutput> {
    const projectMember = await this.service.create(input);
    return { projectMember };
  }

  @Mutation(() => UpdateProjectMemberOutput, {
    description: 'Update a project member',
  })
  async updateProjectMember(
    @Args('input') { projectMember: input }: UpdateProjectMemberInput,
  ): Promise<UpdateProjectMemberOutput> {
    const projectMember = await this.service.update(input);
    return { projectMember };
  }

  @Mutation(() => DeleteProjectMemberOutput, {
    description: 'Delete a project member',
  })
  async deleteProjectMember(
    @IdArg() id: ID,
  ): Promise<DeleteProjectMemberOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
