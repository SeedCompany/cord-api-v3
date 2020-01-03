import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Location } from '../../model/location';
import { LocationService } from './location.service';
import {
  CreateLocationInputDto,
  CreateLocationOutputDto,
  ReadLocationInputDto,
  ReadLocationOutputDto,
  UpdateLocationInputDto,
  UpdateLocationOutputDto,
  DeleteLocationInputDto,
  DeleteLocationOutputDto,
} from './location.dto';

@Resolver(of => Location)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {
  }

  @Mutation(returns => CreateLocationOutputDto, {
    description: 'Create a Location',
  })
  async createLocation(
    @Args('input') { location: input }: CreateLocationInputDto,
  ): Promise<CreateLocationOutputDto> {
    return await this.locationService.create(input);
  }

  @Query(returns => ReadLocationOutputDto, {
    description: 'Read one Location by id',
  })
  async readLocation(
    @Args('input') { location: input }: ReadLocationInputDto,
  ): Promise<ReadLocationOutputDto> {
    return await this.locationService.readOne(input);
  }

  @Mutation(returns => UpdateLocationOutputDto, {
    description: 'Update an Location',
  })
  async updateLocation(
    @Args('input')
      { location: input }: UpdateLocationInputDto,
  ): Promise<UpdateLocationOutputDto> {
    return await this.locationService.update(input);
  }

  @Mutation(returns => DeleteLocationOutputDto, {
    description: 'Delete an Location',
  })
  async deleteLocation(
    @Args('input')
      { location: input }: DeleteLocationInputDto,
  ): Promise<DeleteLocationOutputDto> {
    return await this.locationService.delete(input);
  }
}
