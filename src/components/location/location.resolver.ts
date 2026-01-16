import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { all as countries, whereAlpha3 } from 'iso-3166-1';
import { type ID, IdArg, ListArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegion } from '../field-region/dto';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
import { FundingAccountLoader } from '../funding-account';
import { SecuredFundingAccount } from '../funding-account/dto';
import {
  CreateLocation,
  CreateLocationOutput,
  DeleteLocationOutput,
  Location,
  LocationListInput,
  LocationListOutput,
  SecuredLocation,
  UpdateLocation,
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
    @IdArg() id: ID,
  ): Promise<Location> {
    return await locations.load(id);
  }

  @Query(() => LocationListOutput, {
    description: 'Look up locations',
  })
  async locations(
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<LocationListOutput> {
    const list = await this.locationService.list(input);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredFundingAccount)
  async fundingAccount(
    @Parent() location: Location,
    @Loader(FundingAccountLoader)
    fundingAccounts: LoaderOf<FundingAccountLoader>,
  ): Promise<SecuredFundingAccount> {
    return await mapSecuredValue(location.fundingAccount, ({ id }) =>
      fundingAccounts.load(id),
    );
  }

  @ResolveField(() => SecuredFieldRegion)
  async defaultFieldRegion(
    @Parent() location: Location,
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>,
  ): Promise<SecuredFieldRegion> {
    return await mapSecuredValue(location.defaultFieldRegion, ({ id }) =>
      fieldRegions.load(id),
    );
  }

  @ResolveField(() => SecuredLocation)
  async defaultMarketingRegion(
    @Parent() location: Location,
    @Loader(LocationLoader) defaultMarketingRegions: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(location.defaultMarketingRegion, ({ id }) =>
      defaultMarketingRegions.load(id),
    );
  }

  @ResolveField(() => SecuredFile)
  async mapImage(
    @Parent() location: Location,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, location.mapImage);
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
    return countries();
  }

  @Mutation(() => CreateLocationOutput, {
    description: 'Create a location',
  })
  async createLocation(
    @Args('input') input: CreateLocation,
  ): Promise<CreateLocationOutput> {
    const location = await this.locationService.create(input);
    return { location };
  }

  @Mutation(() => UpdateLocationOutput, {
    description: 'Update a location',
  })
  async updateLocation(
    @Args('input') input: UpdateLocation,
  ): Promise<UpdateLocationOutput> {
    const location = await this.locationService.update(input);
    return { location };
  }

  @Mutation(() => DeleteLocationOutput, {
    description: 'Delete a location',
  })
  async deleteLocation(@IdArg() id: ID): Promise<DeleteLocationOutput> {
    await this.locationService.delete(id);
    return { success: true };
  }
}
