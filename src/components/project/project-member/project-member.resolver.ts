import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '~/common';
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
    @LoggedInSession() session: Session,
    @Args('input') { projectMember: input }: CreateProjectMemberInput,
  ): Promise<CreateProjectMemberOutput> {
    const projectMember = await this.service.create(input, session);
    return { projectMember };
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
