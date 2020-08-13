import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateCountryInput,
  CreateCountryOutput,
  CreatePrivateLocationInput,
  CreatePrivateLocationOutput,
  CreatePublicLocationInput,
  CreatePublicLocationOutput,
  CreateRegionInput,
  CreateRegionOutput,
  CreateZoneInput,
  CreateZoneOutput,
  Location,
  LocationListInput,
  LocationListOutput,
  PrivateLocation,
  PublicLocation,
  UpdateCountryInput,
  UpdateCountryOutput,
  UpdatePrivateLocationInput,
  UpdatePrivateLocationOutput,
  UpdateRegionInput,
  UpdateRegionOutput,
  UpdateZoneInput,
  UpdateZoneOutput,
} from './dto';
import { LocationService } from './location.service';

@Resolver()
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => Location, {
    description: 'Read one Location by id',
  })
  async location(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Location> {
    return await this.locationService.readOne(id, session);
  }

  @Query(() => LocationListOutput, {
    description: 'Look up locations',
  })
  async locations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<LocationListOutput> {
    return this.locationService.list(input, session);
  }

  @Mutation(() => CreateZoneOutput, {
    description: 'Create a zone',
  })
  async createZone(
    @Session() session: ISession,
    @Args('input') { zone: input }: CreateZoneInput
  ): Promise<CreateZoneOutput> {
    const zone = await this.locationService.createZone(input, session);
    return { zone };
  }

  @Mutation(() => CreateRegionOutput, {
    description: 'Create a region',
  })
  async createRegion(
    @Session() session: ISession,
    @Args('input') { region: input }: CreateRegionInput
  ): Promise<CreateRegionOutput> {
    const region = await this.locationService.createRegion(input, session);
    return { region };
  }

  @Mutation(() => CreateCountryOutput, {
    description: 'Create a country',
  })
  async createCountry(
    @Session() session: ISession,
    @Args('input') { country: input }: CreateCountryInput
  ): Promise<CreateCountryOutput> {
    const country = await this.locationService.createCountry(input, session);
    return { country };
  }

  @Mutation(() => UpdateZoneOutput, {
    description: 'Update a zone',
  })
  async updateZone(
    @Session() session: ISession,
    @Args('input') { zone: input }: UpdateZoneInput
  ): Promise<UpdateZoneOutput> {
    const zone = await this.locationService.updateZone(input, session);
    return { zone };
  }

  @Mutation(() => UpdateRegionOutput, {
    description: 'Update a region',
  })
  async updateRegion(
    @Session() session: ISession,
    @Args('input') { region: input }: UpdateRegionInput
  ): Promise<UpdateRegionOutput> {
    const region = await this.locationService.updateRegion(input, session);
    return { region };
  }

  @Mutation(() => UpdateCountryOutput, {
    description: 'Update a country',
  })
  async updateCountry(
    @Session() session: ISession,
    @Args('input') { country: input }: UpdateCountryInput
  ): Promise<UpdateCountryOutput> {
    const country = await this.locationService.updateCountry(input, session);
    return { country };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a location',
  })
  async deleteLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.locationService.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check location consistency',
  })
  async checkLocationConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.locationService.checkLocationConsistency(session);
  }

  @Query(() => PrivateLocation, {
    description: 'Look up a private location by its ID',
  })
  async privateLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<PrivateLocation> {
    return this.locationService.readOnePrivateLocation(id, session);
  }

  @Mutation(() => CreatePrivateLocationOutput, {
    description: 'Create a private location',
  })
  async createPrivateLocation(
    @Session() session: ISession,
    @Args('input') { privateLocation: input }: CreatePrivateLocationInput
  ): Promise<CreatePrivateLocationOutput> {
    const privateLocation = await this.locationService.createPrivateLocation(
      input,
      session
    );
    return { privateLocation };
  }

  @Mutation(() => UpdatePrivateLocationOutput, {
    description: 'Update a private location',
  })
  async updatePrivateLocation(
    @Session() session: ISession,
    @Args('input') { privateLocation: input }: UpdatePrivateLocationInput
  ): Promise<UpdatePrivateLocationOutput> {
    const privateLocation = await this.locationService.updatePrivateLocation(
      input,
      session
    );
    return { privateLocation };
  }

  @Query(() => PublicLocation, {
    description: 'Look up a public location by its ID',
  })
  async publicLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<PublicLocation> {
    return this.locationService.readOnePublicLocation(id, session);
  }

  @Mutation(() => CreatePublicLocationOutput, {
    description: 'Create a public location',
  })
  async createPublicLocation(
    @Session() session: ISession,
    @Args('input') { publicLocation: input }: CreatePublicLocationInput
  ): Promise<CreatePublicLocationOutput> {
    const publicLocation = await this.locationService.createPublicLocation(
      input,
      session
    );
    return { publicLocation };
  }
}
