import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { ProjectMemberService } from '../project-member';
import {
  CreateProjectMemberInput,
  CreateProjectMemberOutput,
  DeleteProjectMemberOutput,
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
