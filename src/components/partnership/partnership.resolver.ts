
import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
//import { Partnership } from './partnership';
import { PartnershipService } from './partnership.service';
import {
  CreatePartnershipInputDto,
  CreatePartnershipOutputDto,
  ReadPartnershipInputDto,
  ReadPartnershipOutputDto,
  UpdatePartnershipInputDto,
  UpdatePartnershipOutputDto,
  DeletePartnershipInputDto,
  DeletePartnershipOutputDto,
} from './partnership.dto';

@Resolver('Partnership')
export class PartnershipResolver {
  constructor(private readonly partnershipService: PartnershipService) {
  }

  @Mutation(returns => CreatePartnershipOutputDto, {
    description: 'Create a Partnership',
  })
  async createPartnership(
    @Args('input') { partnership: input }: CreatePartnershipInputDto,
  ): Promise<CreatePartnershipOutputDto> {
    return await this.partnershipService.create(input);
  }

  
  @Query(returns => ReadPartnershipOutputDto, {
    description: 'Read one Partnership by id',
  })
  async readPartnership(
    @Args('input') { partnership: input }: ReadPartnershipInputDto,
  ): Promise<ReadPartnershipOutputDto> {
    return await this.partnershipService.readOne(input);
  }

  @Mutation(returns => UpdatePartnershipOutputDto, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @Args('input')
      { partnership: input }: UpdatePartnershipInputDto,
  ): Promise<UpdatePartnershipOutputDto> {
    return await this.partnershipService.update(input);
  }

  @Mutation(returns => DeletePartnershipOutputDto, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @Args('input')
      { partnership: input }: DeletePartnershipInputDto,
  ): Promise<DeletePartnershipOutputDto> {
    return await this.partnershipService.delete(input);
  }
  
}