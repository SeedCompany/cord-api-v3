import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { ProjectLoader } from '../project';
import { IProject, type Project } from '../project/dto';
import {
  CreateProjectChangeRequest,
  CreateProjectChangeRequestOutput,
  DeleteProjectChangeRequestOutput,
  ProjectChangeRequest,
  UpdateProjectChangeRequest,
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
    @Args('input') input: CreateProjectChangeRequest,
  ): Promise<CreateProjectChangeRequestOutput> {
    const projectChangeRequest = await this.service.create(input);
    return { projectChangeRequest };
  }

  @Mutation(() => UpdateProjectChangeRequestOutput, {
    description: 'Update a project change request',
  })
  async updateProjectChangeRequest(
    @Args('input') input: UpdateProjectChangeRequest,
  ): Promise<UpdateProjectChangeRequestOutput> {
    const projectChangeRequest = await this.service.update(input);
    return { projectChangeRequest };
  }

  @Mutation(() => DeleteProjectChangeRequestOutput, {
    description: 'Delete a project change request',
  })
  async deleteProjectChangeRequest(
    @IdArg() id: ID,
  ): Promise<DeleteProjectChangeRequestOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
