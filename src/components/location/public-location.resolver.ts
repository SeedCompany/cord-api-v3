import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import {
  FundingAccountService,
  SecuredFundingAccount,
} from '../funding-account';
import {
  MarketingLocationService,
  SecuredMarketingLocation,
} from '../marketing-location';
import {
  RegistryOfGeographyService,
  SecuredRegistryOfGeography,
} from '../registry-of-geography';
import { PublicLocation, SecuredPrivateLocation } from './dto';
import { LocationService } from './location.service';

@Resolver(PublicLocation)
export class PublicLocationResolver {
  constructor(
    private readonly locationService: LocationService,
    private readonly fundingAccountService: FundingAccountService,
    private readonly registryOfGeographyService: RegistryOfGeographyService,
    private readonly marketingLocationService: MarketingLocationService
  ) {}

  @ResolveField(() => SecuredMarketingLocation)
  async marketingLocation(
    @Parent() publicLocation: PublicLocation,
    @Session() session: ISession
  ): Promise<SecuredMarketingLocation> {
    const { value: id, ...rest } = publicLocation.marketingLocation;
    const value = id
      ? await this.marketingLocationService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredPrivateLocation)
  async privateLocation(
    @Parent() publicLocation: PublicLocation,
    @Session() session: ISession
  ): Promise<SecuredPrivateLocation> {
    const { value: id, ...rest } = publicLocation.privateLocation;
    const value = id
      ? await this.locationService.readOnePrivateLocation(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredRegistryOfGeography)
  async registryOfGeography(
    @Parent() publicLocation: PublicLocation,
    @Session() session: ISession
  ): Promise<SecuredRegistryOfGeography> {
    const { value: id, ...rest } = publicLocation.registryOfGeography;
    const value = id
      ? await this.registryOfGeographyService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredFundingAccount)
  async fundingAccount(
    @Parent() publicLocation: PublicLocation,
    @Session() session: ISession
  ): Promise<SecuredFundingAccount> {
    const { value: id, ...rest } = publicLocation.fundingAccount;
    const value = id
      ? await this.fundingAccountService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }
}
