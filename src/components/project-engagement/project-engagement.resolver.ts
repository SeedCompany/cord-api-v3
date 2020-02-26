import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { ProjectEngagement } from './engagement';
import { ProjectEngagementService } from './project-engagement.service';
import {
  CreateProjectEngagementInputDto,
  CreateProjectEngagementOutputDto,
  ReadProjectEngagementInputDto,
  ReadProjectEngagementOutputDto,
  UpdateProjectEngagementInputDto,
  UpdateProjectEngagementOutputDto,
  DeleteProjectEngagementInputDto,
  DeleteProjectEngagementOutputDto,
} from './project-engagement.dto';

@Resolver()
export class ProjectEngagementResolver {
  constructor(private readonly projectEngagementService: ProjectEngagementService) {
  }

  @Mutation(returns => CreateProjectEngagementOutputDto, {
    description: 'Create a ProjectEngagement',
  })
  async createProjectEngagement(
    @Args('input') { projectEngagement: input }: CreateProjectEngagementInputDto,
  ): Promise<CreateProjectEngagementOutputDto> {
    return await this.projectEngagementService.create(input);
  }

  @Query(returns => ReadProjectEngagementOutputDto, {
    description: 'Read one ProjectEngagement by id',
  })
  async readProjectEngagement(
    @Args('input') { projectEngagement: input }: ReadProjectEngagementInputDto,
  ): Promise<ReadProjectEngagementOutputDto> {
    return await this.projectEngagementService.readOne(input);
  }

  @Mutation(returns => UpdateProjectEngagementOutputDto, {
    description: 'Update an ProjectEngagement',
  })
  async updateProjectEngagement(
    @Args('input')
      { projectEngagement: input }: UpdateProjectEngagementInputDto,
  ): Promise<UpdateProjectEngagementOutputDto> {
    return await this.projectEngagementService.update(input);
  }

  @Mutation(returns => DeleteProjectEngagementOutputDto, {
    description: 'Delete an ProjectEngagement',
  })
  async deleteProjectEngagement(
    @Args('input')
      { projectEngagement: input }: DeleteProjectEngagementInputDto,
  ): Promise<DeleteProjectEngagementOutputDto> {
    return await this.projectEngagementService.delete(input);
  }
}
