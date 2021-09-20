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
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { FieldRegionService, SecuredFieldRegion } from '../field-region';
import {
  FundingAccountService,
  SecuredFundingAccount,
} from '../funding-account';
import {
  CreateLocationInput,
  CreateLocationOutput,
  Location,
  LocationListInput,
  LocationListOutput,
  UpdateLocationInput,
  UpdateLocationOutput,
} from './dto';
import { IsoCountry } from './dto/iso-country.dto';
import { LocationService } from './location.service';

@Resolver(Location)
export class LocationResolver {
  constructor(
    private readonly fieldRegionService: FieldRegionService,
    private readonly locationService: LocationService,
    private readonly fundingAccountService: FundingAccountService
  ) {}

  @Query(() => Location, {
    description: 'Read one Location by id',
  })
  async location(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Location> {
    return await this.locationService.readOne(id, session);
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
    input: LocationListInput
  ): Promise<LocationListOutput> {
    return await this.locationService.list(input, session);
  }

  @ResolveField(() => SecuredFundingAccount)
  async fundingAccount(
    @Parent() location: Location,
    @AnonSession() session: Session
  ): Promise<SecuredFundingAccount> {
    const { value: id, ...rest } = location.fundingAccount;
    const value = id
      ? await this.fundingAccountService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredFieldRegion)
  async defaultFieldRegion(
    @Parent() location: Location,
    @AnonSession() session: Session
  ): Promise<SecuredFieldRegion> {
    const { value: id, ...rest } = location.defaultFieldRegion;
    const value = id
      ? await this.fieldRegionService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
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

  @Mutation(() => Boolean, {
    description: 'Delete a location',
  })
  async deleteLocation(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.locationService.delete(id, session);
    return true;
  }
}
