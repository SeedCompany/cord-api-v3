import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreatePartnershipInputDto,
  CreatePartnershipOutputDto,
  DeletePartnershipInputDto,
  DeletePartnershipOutputDto,
  ListPartnershipsInputDto,
  ListPartnershipsOutputDto,
  ReadPartnershipInputDto,
  ReadPartnershipOutputDto,
  UpdatePartnershipInputDto,
  UpdatePartnershipOutputDto,
} from './partnership.dto';
import { PartnershipService } from './partnership.service';

@Resolver('Partnership')
export class PartnershipResolver {
  constructor(private readonly partnershipService: PartnershipService) {}

  @Mutation(() => CreatePartnershipOutputDto, {
    description: 'Create a Partnership',
  })
  async createPartnership(
    @Args('input') { partnership: input }: CreatePartnershipInputDto
  ): Promise<CreatePartnershipOutputDto> {
    return await this.partnershipService.create(input);
  }

  @Query(() => ReadPartnershipOutputDto, {
    description: 'Read one Partnership by id',
  })
  async readPartnership(
    @Args('input') { partnership: input }: ReadPartnershipInputDto
  ): Promise<ReadPartnershipOutputDto> {
    return await this.partnershipService.readOne(input);
  }

  @Query(() => ListPartnershipsOutputDto, {
    description: 'Query partnership',
  })
  async partnerships(
    @Args('input') { query: input }: ListPartnershipsInputDto
  ): Promise<ListPartnershipsOutputDto> {
    return await this.partnershipService.queryPartnerships(input);
  }

  @Mutation(() => UpdatePartnershipOutputDto, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @Args('input')
    { partnership: input }: UpdatePartnershipInputDto
  ): Promise<UpdatePartnershipOutputDto> {
    return await this.partnershipService.update(input);
  }

  @Mutation(() => DeletePartnershipOutputDto, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @Args('input')
    { partnership: input }: DeletePartnershipInputDto
  ): Promise<DeletePartnershipOutputDto> {
    return await this.partnershipService.delete(input);
  }
}
