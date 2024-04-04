import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { ProjectLoader } from '../project';
import { IProject, Project } from '../project/dto';
import {
  CreateProjectChangeRequestInput,
  CreateProjectChangeRequestOutput,
  DeleteProjectChangeRequestOutput,
  ProjectChangeRequest,
  UpdateProjectChangeRequestInput,
  UpdateProjectChangeRequestOutput,
} from './dto';
import { ProjectChangeRequestService } from './project-change-request.service';

@Resolver(ProjectChangeRequest)
export class ProjectChangeRequestResolver {
  constructor(private readonly service: ProjectChangeRequestService) {}

  @ResolveField(() => IProject)
  async project(
    @Parent() changeset: ProjectChangeRequest,
    @Loader(() => ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<Project> {
    return await projects.load({
      id: changeset.project,
      view: { changeset: changeset.id },
    });
  }

  @Mutation(() => CreateProjectChangeRequestOutput, {
    description: 'Create a project change request',
  })
  async createProjectChangeRequest(
    @Args('input')
    { projectChangeRequest: input }: CreateProjectChangeRequestInput,
    @LoggedInSession() session: Session,
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
    { projectChangeRequest: input }: UpdateProjectChangeRequestInput,
  ): Promise<UpdateProjectChangeRequestOutput> {
    const projectChangeRequest = await this.service.update(input, session);
    return { projectChangeRequest };
  }

  @Mutation(() => DeleteProjectChangeRequestOutput, {
    description: 'Delete a project change request',
  })
  async deleteProjectChangeRequest(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteProjectChangeRequestOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }
}
