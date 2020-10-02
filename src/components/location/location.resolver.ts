import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
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
import { LocationService } from './location.service';

@Resolver(Location)
export class LocationResolver {
  constructor(
    private readonly locationService: LocationService,
    private readonly fundingAccountService: FundingAccountService
  ) {}

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

  @ResolveField(() => SecuredFundingAccount)
  async fundingAccount(
    @Parent() location: Location,
    @Session() session: ISession
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

  @Mutation(() => CreateLocationOutput, {
    description: 'Create a location',
  })
  async createLocation(
    @Session() session: ISession,
    @Args('input') { location: input }: CreateLocationInput
  ): Promise<CreateLocationOutput> {
    const location = await this.locationService.create(input, session);
    return { location };
  }

  @Mutation(() => UpdateLocationOutput, {
    description: 'Update a location',
  })
  async updateLocation(
    @Session() session: ISession,
    @Args('input') { location: input }: UpdateLocationInput
  ): Promise<UpdateLocationOutput> {
    const location = await this.locationService.update(input, session);
    return { location };
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
}
