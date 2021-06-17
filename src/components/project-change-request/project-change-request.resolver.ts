import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreateProjectChangeRequestInput,
  CreateProjectChangeRequestOutput,
  ProjectChangeRequest,
  UpdateProjectChangeRequestInput,
  UpdateProjectChangeRequestOutput,
} from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@Resolver(ProjectChangeRequest)
export class ProjectChangeRequestResolver {
  constructor(private readonly service: ProjectChangeRequestService) {}

  @ResolveField(() => Boolean)
  async canEdit(
    @Parent() projectChangeRequest: ProjectChangeRequest,
    @AnonSession() session: Session
  ): Promise<boolean> {
    return await this.service.canEdit(projectChangeRequest, session);
  }

  @Mutation(() => CreateProjectChangeRequestOutput, {
    description: 'Create a project change request',
  })
  async createProjectChangeRequest(
    @Args('input')
    { projectChangeRequest: input }: CreateProjectChangeRequestInput,
    @LoggedInSession() session: Session
  ): Promise<CreateProjectChangeRequestOutput> {
    const projectChangeRequest = await this.service.create(input, session);
    return { projectChangeRequest };
  }

  @Mutation(() => UpdateProjectChangeRequestOutput, {
    description: 'Update a project change request',
  })
  async updateProjectChangeRequest(
    @LoggedInSession() session: Session,
    @Args('input')
    { projectChangeRequest: input }: UpdateProjectChangeRequestInput
  ): Promise<UpdateProjectChangeRequestOutput> {
    const projectChangeRequest = await this.service.update(input, session);
    return { projectChangeRequest };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project change request',
  })
  async deleteProjectChangeRequest(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
