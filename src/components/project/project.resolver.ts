import { Injectable } from '@nestjs/common';
import {
  Args,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { IdArg } from '../../common';
import { ISession, Session } from '../auth';
import {
  CreateProjectInput,
  CreateProjectOutput,
  Project,
  ProjectListInput,
  ProjectListOutput,
  UpdateProjectInput,
  UpdateProjectOutput,
} from './dto';
import { ProjectService } from './project.service';

@Resolver('Project')
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => Project, {
    description: 'Look up a project by its ID',
  })
  async project(
    @IdArg() id: string,
    @Session() session: ISession,
  ): Promise<Project> {
    return this.projectService.readOne(id, session);
  }

  @Query(() => ProjectListOutput, {
    description: 'Look up projects',
  })
  async projects(
    @Args({
      name: 'input',
      type: () => ProjectListInput,
      nullable: true,
      defaultValue: ProjectListInput.defaultVal,
    })
    input: ProjectListInput,
    @Session() session: ISession,
  ): Promise<ProjectListOutput> {
    return this.projectService.list(input, session);
  }

  @Mutation(() => CreateProjectOutput, {
    description: 'Create a project',
  })
  async createProject(
    @Args('input') { project: input }: CreateProjectInput,
    @Session() session: ISession,
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input, session);
    return { project };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input }: UpdateProjectInput,
    @Session() session: ISession,
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, session);
    return { project };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project',
  })
  async deleteProject(
    @IdArg() id: string,
    @Session() session: ISession,
  ): Promise<boolean> {
    await this.projectService.delete(id, session);
    return true;
  }
}
