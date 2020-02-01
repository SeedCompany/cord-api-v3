import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { IdArg, Token } from '../../common';
import {
  Location,
  CreateRegionOutput,
  LocationListInput,
  LocationListOutput,
  CreateRegionInput,
  CreateAreaOutput,
  CreateAreaInput,
  CreateCountryOutput,
  CreateCountryInput,
  UpdateRegionOutput,
  UpdateRegionInput,
  UpdateAreaOutput,
  UpdateAreaInput,
  UpdateCountryOutput,
  UpdateCountryInput,
} from './dto';
import { LocationService } from './location.service';

@Resolver()
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => Location, {
    description: 'Read one Location by id',
  })
  async location(
    @Token() token: string,
    @IdArg() id: string,
  ): Promise<Location> {
    return this.locationService.readOne(id, token);
  }

  @Query(() => LocationListOutput, {
    description: 'Look up locations',
  })
  async locations(
    @Token() token: string,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput,
  ): Promise<LocationListOutput> {
    return this.locationService.list(input, token);
  }

  @Mutation(() => CreateRegionOutput, {
    description: 'Create a region',
  })
  async createRegion(
    @Token() token: string,
    @Args('input') { region: input }: CreateRegionInput,
  ): Promise<CreateRegionOutput> {
    const region = await this.locationService.createRegion(input, token);
    return { region };
  }

  @Mutation(() => CreateAreaOutput, {
    description: 'Create an area',
  })
  async createArea(
    @Token() token: string,
    @Args('input') { area: input }: CreateAreaInput,
  ): Promise<CreateAreaOutput> {
    const area = await this.locationService.createArea(input, token);
    return { area };
  }

  @Mutation(() => CreateCountryOutput, {
    description: 'Create a country',
  })
  async createCountry(
    @Token() token: string,
    @Args('input') { country: input }: CreateCountryInput,
  ): Promise<CreateCountryOutput> {
    const country = await this.locationService.createCountry(input, token);
    return { country };
  }

  @Mutation(() => UpdateRegionOutput, {
    description: 'Update a region',
  })
  async updateRegion(
    @Token() token: string,
    @Args('input') { region: input }: UpdateRegionInput,
  ): Promise<UpdateRegionOutput> {
    const region = await this.locationService.updateRegion(input, token);
    return { region };
  }

  @Mutation(() => UpdateAreaOutput, {
    description: 'Update an area',
  })
  async updateArea(
    @Token() token: string,
    @Args('input') { area: input }: UpdateAreaInput,
  ): Promise<UpdateAreaOutput> {
    const area = await this.locationService.updateArea(input, token);
    return { area };
  }

  @Mutation(() => UpdateCountryOutput, {
    description: 'Update a country',
  })
  async updateCountry(
    @Token() token: string,
    @Args('input') { country: input }: UpdateCountryInput,
  ): Promise<UpdateCountryOutput> {
    const country = await this.locationService.updateCountry(input, token);
    return { country };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a location',
  })
  async deleteLocation(
    @Token() token: string,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.locationService.delete(id, token);
    return true;
  }
}
