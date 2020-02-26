import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Internship } from './internship';
import { InternshipService } from './internship.service';
import {
  CreateInternshipInputDto,
  CreateInternshipOutputDto,
  ReadInternshipInputDto,
  ReadInternshipOutputDto,
  UpdateInternshipInputDto,
  UpdateInternshipOutputDto,
  DeleteInternshipInputDto,
  DeleteInternshipOutputDto,
} from './internship.dto';

@Resolver()
export class InternshipResolver {
  constructor(private readonly internshipService: InternshipService) {
  }

  @Mutation(returns => CreateInternshipOutputDto, {
    description: 'Create a Internship',
  })
  async createInternship(
    @Args('input') { internship: input }: CreateInternshipInputDto,
  ): Promise<CreateInternshipOutputDto> {
    return await this.internshipService.create(input);
  }

  @Query(returns => ReadInternshipOutputDto, {
    description: 'Read one Internship by id',
  })
  async readInternship(
    @Args('input') { internship: input }: ReadInternshipInputDto,
  ): Promise<ReadInternshipOutputDto> {
    return await this.internshipService.readOne(input);
  }

  @Mutation(returns => UpdateInternshipOutputDto, {
    description: 'Update an Internship',
  })
  async updateInternship(
    @Args('input')
      { internship: input }: UpdateInternshipInputDto,
  ): Promise<UpdateInternshipOutputDto> {
    return await this.internshipService.update(input);
  }

  @Mutation(returns => DeleteInternshipOutputDto, {
    description: 'Delete an Internship',
  })
  async deleteInternship(
    @Args('input')
      { internship: input }: DeleteInternshipInputDto,
  ): Promise<DeleteInternshipOutputDto> {
    return await this.internshipService.delete(input);
  }
}
