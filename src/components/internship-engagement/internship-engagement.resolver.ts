import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateInternshipEngagementInputDto,
  CreateInternshipEngagementOutputDto,
  DeleteInternshipEngagementInputDto,
  DeleteInternshipEngagementOutputDto,
  ReadInternshipEngagementInputDto,
  ReadInternshipEngagementOutputDto,
  UpdateInternshipEngagementInputDto,
  UpdateInternshipEngagementOutputDto,
} from './internship-engagement.dto';
import { InternshipEngagementService } from './internship-engagement.service';

@Resolver()
export class InternshipEngagementResolver {
  constructor(
    private readonly internshipEngagementService: InternshipEngagementService
  ) {}

  @Mutation(() => CreateInternshipEngagementOutputDto, {
    description: 'Create a InternshipEngagement',
  })
  async createInternshipEngagement(
    @Args('input')
    { internshipEngagement: input }: CreateInternshipEngagementInputDto
  ): Promise<CreateInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.create(input);
  }

  @Query(() => ReadInternshipEngagementOutputDto, {
    description: 'Read one InternshipEngagement by id',
  })
  async readInternshipEngagement(
    @Args('input')
    { internshipEngagement: input }: ReadInternshipEngagementInputDto
  ): Promise<ReadInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.readOne(input);
  }

  @Mutation(() => UpdateInternshipEngagementOutputDto, {
    description: 'Update an InternshipEngagement',
  })
  async updateInternshipEngagement(
    @Args('input')
    { internshipEngagement: input }: UpdateInternshipEngagementInputDto
  ): Promise<UpdateInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.update(input);
  }

  @Mutation(() => DeleteInternshipEngagementOutputDto, {
    description: 'Delete an InternshipEngagement',
  })
  async deleteInternshipEngagement(
    @Args('input')
    { internshipEngagement: input }: DeleteInternshipEngagementInputDto
  ): Promise<DeleteInternshipEngagementOutputDto> {
    return await this.internshipEngagementService.delete(input);
  }
}
