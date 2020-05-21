import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { CreateBudgetInput, CreateBudgetOutput } from '../budget';
import {
  CreateProjectInput,
  CreateProjectOutput,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  UpdateProjectInput,
  UpdateProjectOutput,
} from './dto';
import { ProjectService } from './project.service';

@Resolver()
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => IProject, {
    description: 'Look up a project by its ID',
  })
  async project(
    @IdArg() id: string,
    @Session() session: ISession
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
    @Session() session: ISession
  ): Promise<ProjectListOutput> {
    return this.projectService.list(input, session);
  }

  @Mutation(() => CreateProjectOutput, {
    description: 'Create a project',
  })
  async createProject(
    @Args('input') { project: input }: CreateProjectInput,
    @Session() session: ISession
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input, session);
    return { project };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input }: UpdateProjectInput,
    @Session() session: ISession
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, session);
    return { project };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project',
  })
  async deleteProject(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<boolean> {
    await this.projectService.delete(id, session);
    return true;
  }

  @Mutation(() => CreateBudgetOutput, {
    description: 'Create an budget entry',
  })
  async createBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: CreateBudgetInput
  ): Promise<CreateBudgetOutput> {
    const project = await this.projectService.readOne(input.projectId, session);
    const budget = await this.projectService.createBudget(project, session);
    return { budget };
  }

  @Query(() => Boolean, {
    description: 'Check Consistency in Project Nodes',
  })
  async checkProjectConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return this.projectService.consistencyChecker(session);
  }
}
