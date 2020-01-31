import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { IdArg, RequestUser } from '../../common';
import {
  CreateCountryInput,
  CreateCountryOutput,
  CreateRegionInput,
  CreateRegionOutput,
  CreateZoneInput,
  CreateZoneOutput,
  Location,
  LocationListInput,
  LocationListOutput,
  UpdateCountryInput,
  UpdateCountryOutput,
  UpdateRegionOutput,
  UpdateRegionInput,
  UpdateZoneOutput,
  UpdateZoneInput,
} from './dto';
import { LocationService } from './location.service';

@Resolver()
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => Location, {
    description: 'Read one Location by id',
  })
  async location(
    @RequestUser() token: string,
    @IdArg() id: string,
  ): Promise<Location> {
    return this.locationService.readOne(id, token);
  }

  @Query(() => LocationListOutput, {
    description: 'Look up locations',
  })
  async locations(
    @RequestUser() token: string,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput,
  ): Promise<LocationListOutput> {
    return this.locationService.list(input, token);
  }

  @Mutation(() => CreateZoneOutput, {
    description: 'Create a zone',
  })
  async createZone(
    @RequestUser() token: string,
    @Args('input') { zone: input }: CreateZoneInput,
  ): Promise<CreateZoneOutput> {
    const zone = await this.locationService.createZone(input, token);
    return { zone };
  }

  @Mutation(() => CreateRegionOutput, {
    description: 'Create a region',
  })
  async createRegion(
    @RequestUser() token: string,
    @Args('input') { region: input }: CreateRegionInput,
  ): Promise<CreateRegionOutput> {
    const region = await this.locationService.createRegion(input, token);
    return { region };
  }

  @Mutation(() => CreateCountryOutput, {
    description: 'Create a country',
  })
  async createCountry(
    @RequestUser() token: string,
    @Args('input') { country: input }: CreateCountryInput,
  ): Promise<CreateCountryOutput> {
    const country = await this.locationService.createCountry(input, token);
    return { country };
  }

  @Mutation(() => UpdateZoneOutput, {
    description: 'Update a zone',
  })
  async updateZone(
    @RequestUser() token: string,
    @Args('input') { zone: input }: UpdateZoneInput,
  ): Promise<UpdateZoneOutput> {
    const zone = await this.locationService.updateZone(input, token);
    return { zone };
  }

  @Mutation(() => UpdateRegionOutput, {
    description: 'Update a region',
  })
  async updateRegion(
    @RequestUser() token: string,
    @Args('input') { region: input }: UpdateRegionInput,
  ): Promise<UpdateRegionOutput> {
    const region = await this.locationService.updateRegion(input, token);
    return { region };
  }

  @Mutation(() => UpdateCountryOutput, {
    description: 'Update a country',
  })
  async updateCountry(
    @RequestUser() token: string,
    @Args('input') { country: input }: UpdateCountryInput,
  ): Promise<UpdateCountryOutput> {
    const country = await this.locationService.updateCountry(input, token);
    return { country };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a location',
  })
  async deleteLocation(
    @RequestUser() token: string,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.locationService.delete(id, token);
    return true;
  }
}
