import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { whereAlpha3 } from 'iso-3166-1';
import countries from 'iso-3166-1/dist/iso-3166';
import {
  AnonSession,
  ID,
  IdArg,
  LoggedInSession,
  mapSecuredValue,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { FieldRegionLoader, SecuredFieldRegion } from '../field-region';
import {
  FundingAccountLoader,
  SecuredFundingAccount,
} from '../funding-account';
import {
  CreateLocationInput,
  CreateLocationOutput,
  DeleteLocationOutput,
  Location,
  LocationListInput,
  LocationListOutput,
  UpdateLocationInput,
  UpdateLocationOutput,
} from './dto';
import { IsoCountry } from './dto/iso-country.dto';
import { LocationLoader } from './location.loader';
import { LocationService } from './location.service';

@Resolver(Location)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => Location, {
    description: 'Read one Location by id',
  })
  async location(
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
    @IdArg() id: ID
  ): Promise<Location> {
    return await locations.load(id);
  }

  @Query(() => LocationListOutput, {
    description: 'Look up locations',
  })
  async locations(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<LocationListOutput> {
    const list = await this.locationService.list(input, session);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredFundingAccount)
  async fundingAccount(
    @Parent() location: Location,
    @Loader(FundingAccountLoader)
    fundingAccounts: LoaderOf<FundingAccountLoader>
  ): Promise<SecuredFundingAccount> {
    return await mapSecuredValue(location.fundingAccount, (id) =>
      fundingAccounts.load(id)
    );
  }

  @ResolveField(() => SecuredFieldRegion)
  async defaultFieldRegion(
    @Parent() location: Location,
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>
  ): Promise<SecuredFieldRegion> {
    return await mapSecuredValue(location.defaultFieldRegion, (id) =>
      fieldRegions.load(id)
    );
  }

  @ResolveField(() => IsoCountry, {
    nullable: true,
    description:
      "An ISO 3166-1 country, looked up by the `Location`'s `isoAlpha3` code",
  })
  async isoCountry(@Parent() location: Location): Promise<IsoCountry | null> {
    const { value, canRead } = location.isoAlpha3;
    if (!value || !canRead) {
      return null;
    }
    return whereAlpha3(value) ?? null;
  }

  @Query(() => [IsoCountry], {
    description: 'A list of ISO 3166-1 countries',
  })
  async isoCountries(): Promise<IsoCountry[]> {
    return countries;
  }

  @Mutation(() => CreateLocationOutput, {
    description: 'Create a location',
  })
  async createLocation(
    @LoggedInSession() session: Session,
    @Args('input') { location: input }: CreateLocationInput
  ): Promise<CreateLocationOutput> {
    const location = await this.locationService.create(input, session);
    return { location };
  }

  @Mutation(() => UpdateLocationOutput, {
    description: 'Update a location',
  })
  async updateLocation(
    @LoggedInSession() session: Session,
    @Args('input') { location: input }: UpdateLocationInput
  ): Promise<UpdateLocationOutput> {
    const location = await this.locationService.update(input, session);
    return { location };
  }

  @Mutation(() => DeleteLocationOutput, {
    description: 'Delete a location',
  })
  async deleteLocation(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteLocationOutput> {
    await this.locationService.delete(id, session);
    return { success: true };
  }
}
