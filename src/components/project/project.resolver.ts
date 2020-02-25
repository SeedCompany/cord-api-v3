import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Project } from './project';
import { ProjectService } from './project.service';
import {
  CreateProjectInputDto,
  CreateProjectOutputDto,
  ReadProjectInputDto,
  ReadProjectOutputDto,
  UpdateProjectInputDto,
  UpdateProjectOutputDto,
  DeleteProjectInputDto,
  DeleteProjectOutputDto,
} from './project.dto';

@Resolver()
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {
  }

  @Mutation(returns => CreateProjectOutputDto, {
    description: 'Create a Project',
  })
  async createProject(
    @Args('input') { project: input }: CreateProjectInputDto,
  ): Promise<CreateProjectOutputDto> {
    return await this.projectService.create(input);
  }

  @Query(returns => ReadProjectOutputDto, {
    description: 'Read one Project by id',
  })
  async readProject(
    @Args('input') { project: input }: ReadProjectInputDto,
  ): Promise<ReadProjectOutputDto> {
    return await this.projectService.readOne(input);
  }

  @Mutation(returns => UpdateProjectOutputDto, {
    description: 'Update an Project',
  })
  async updateProject(
    @Args('input')
      { project: input }: UpdateProjectInputDto,
  ): Promise<UpdateProjectOutputDto> {
    return await this.projectService.update(input);
  }

  @Mutation(returns => DeleteProjectOutputDto, {
    description: 'Delete an Project',
  })
  async deleteProject(
    @Args('input')
      { project: input }: DeleteProjectInputDto,
  ): Promise<DeleteProjectOutputDto> {
    return await this.projectService.delete(input);
  }
}
