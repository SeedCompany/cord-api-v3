import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Region } from '../../model/region';
import { RegionService } from './region.service';
import {
  CreateRegionInputDto,
  CreateRegionOutputDto,
  ReadRegionInputDto,
  ReadRegionOutputDto,
  UpdateRegionInputDto,
  UpdateRegionOutputDto,
  DeleteRegionInputDto,
  DeleteRegionOutputDto,
} from './region.dto';

@Resolver(of => Region)
export class RegionResolver {
  constructor(private readonly regionService: RegionService) {
  }

  @Mutation(returns => CreateRegionOutputDto, {
    description: 'Create a Region',
  })
  async createRegion(
    @Args('input') { region: input }: CreateRegionInputDto,
  ): Promise<CreateRegionOutputDto> {
    return await this.regionService.create(input);
  }

  @Query(returns => ReadRegionOutputDto, {
    description: 'Read one Region by id',
  })
  async readRegion(
    @Args('input') { region: input }: ReadRegionInputDto,
  ): Promise<ReadRegionOutputDto> {
    return await this.regionService.readOne(input);
  }

  @Mutation(returns => UpdateRegionOutputDto, {
    description: 'Update an Region',
  })
  async updateRegion(
    @Args('input')
      { region: input }: UpdateRegionInputDto,
  ): Promise<UpdateRegionOutputDto> {
    return await this.regionService.update(input);
  }

  @Mutation(returns => DeleteRegionOutputDto, {
    description: 'Delete an Region',
  })
  async deleteRegion(
    @Args('input')
      { region: input }: DeleteRegionInputDto,
  ): Promise<DeleteRegionOutputDto> {
    return await this.regionService.delete(input);
  }
}
