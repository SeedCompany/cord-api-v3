import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { InternshipEngagement } from './engagement';
import { InternshipEngagementService } from './internship-engagement.service';
import {
  CreateInternshipEngagementInputDto,
  CreateInternshipEngagementOutputDto,
  ReadInternshipEngagementInputDto,
  ReadInternshipEngagementOutputDto,
  UpdateInternshipEngagementInputDto,
  UpdateInternshipEngagementOutputDto,
  DeleteInternshipEngagementInputDto,
  DeleteInternshipEngagementOutputDto,
} from './internship-engagement.dto';

@Resolver(of => InternshipEngagement)
export class InternshipEngagementResolver {
  constructor(private readonly internshipEngagementService: InternshipEngagementService) {
  }

  @Mutation(returns => CreateInternshipEngagementOutputDto, {
    description: 'Create a InternshipEngagement',
  })
  async createInternshipEngagement(
    @Args('input') { internshipEngagement: input }: CreateInternshipEngagementInputDto,
  ): Promise<CreateInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.create(input);
  }

  @Query(returns => ReadInternshipEngagementOutputDto, {
    description: 'Read one InternshipEngagement by id',
  })
  async readInternshipEngagement(
    @Args('input') { internshipEngagement: input }: ReadInternshipEngagementInputDto,
  ): Promise<ReadInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.readOne(input);
  }

  @Mutation(returns => UpdateInternshipEngagementOutputDto, {
    description: 'Update an InternshipEngagement',
  })
  async updateInternshipEngagement(
    @Args('input')
      { internshipEngagement: input }: UpdateInternshipEngagementInputDto,
  ): Promise<UpdateInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.update(input);
  }

  @Mutation(returns => DeleteInternshipEngagementOutputDto, {
    description: 'Delete an InternshipEngagement',
  })
  async deleteInternshipEngagement(
    @Args('input')
      { internshipEngagement: input }: DeleteInternshipEngagementInputDto,
  ): Promise<DeleteInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.delete(input);
  }
}
