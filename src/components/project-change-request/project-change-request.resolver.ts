import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProjectLoader } from '../project';
import { IProject, type Project } from '../project/dto';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestCreated,
  ProjectChangeRequestDeleted,
  ProjectChangeRequestUpdated,
  UpdateProjectChangeRequest,
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

  @Mutation(() => ProjectChangeRequestCreated, {
    description: 'Create a project change request',
  })
  async createProjectChangeRequest(
    @Args('input') input: CreateProjectChangeRequest,
  ): Promise<ProjectChangeRequestCreated> {
    const projectChangeRequest = await this.service.create(input);
    return { projectChangeRequest };
  }

  @Mutation(() => ProjectChangeRequestUpdated, {
    description: 'Update a project change request',
  })
  async updateProjectChangeRequest(
    @Args('input') input: UpdateProjectChangeRequest,
  ): Promise<ProjectChangeRequestUpdated> {
    const projectChangeRequest = await this.service.update(input);
    return { projectChangeRequest };
  }

  @Mutation(() => ProjectChangeRequestDeleted, {
    description: 'Delete a project change request',
  })
  async deleteProjectChangeRequest(
    @IdArg() id: ID,
  ): Promise<ProjectChangeRequestDeleted> {
    await this.service.delete(id);
    return {};
  }
}
