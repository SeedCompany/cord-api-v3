import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateProjectEngagementInputDto,
  CreateProjectEngagementOutputDto,
  DeleteProjectEngagementInputDto,
  DeleteProjectEngagementOutputDto,
  ReadProjectEngagementInputDto,
  ReadProjectEngagementOutputDto,
  UpdateProjectEngagementInputDto,
  UpdateProjectEngagementOutputDto,
} from './project-engagement.dto';
import { ProjectEngagementService } from './project-engagement.service';

@Resolver()
export class ProjectEngagementResolver {
  constructor(
    private readonly projectEngagementService: ProjectEngagementService
  ) {}

  @Mutation(() => CreateProjectEngagementOutputDto, {
    description: 'Create a ProjectEngagement',
  })
  async createProjectEngagement(
    @Args('input') { projectEngagement: input }: CreateProjectEngagementInputDto
  ): Promise<CreateProjectEngagementOutputDto> {
    return await this.projectEngagementService.create(input);
  }

  @Query(() => ReadProjectEngagementOutputDto, {
    description: 'Read one ProjectEngagement by id',
  })
  async readProjectEngagement(
    @Args('input') { projectEngagement: input }: ReadProjectEngagementInputDto
  ): Promise<ReadProjectEngagementOutputDto> {
    return await this.projectEngagementService.readOne(input);
  }

  @Mutation(() => UpdateProjectEngagementOutputDto, {
    description: 'Update an ProjectEngagement',
  })
  async updateProjectEngagement(
    @Args('input')
    { projectEngagement: input }: UpdateProjectEngagementInputDto
  ): Promise<UpdateProjectEngagementOutputDto> {
    return await this.projectEngagementService.update(input);
  }

  @Mutation(() => DeleteProjectEngagementOutputDto, {
    description: 'Delete an ProjectEngagement',
  })
  async deleteProjectEngagement(
    @Args('input')
    { projectEngagement: input }: DeleteProjectEngagementInputDto
  ): Promise<DeleteProjectEngagementOutputDto> {
    return await this.projectEngagementService.delete(input);
  }
}
