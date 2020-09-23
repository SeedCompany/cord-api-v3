import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateMarketingLocationInput,
  CreateMarketingLocationOutput,
  MarketingLocation,
  MarketingLocationListInput,
  MarketingLocationListOutput,
  UpdateMarketingLocationInput,
  UpdateMarketingLocationOutput,
} from './dto';
import { MarketingLocationService } from './marketing-location.service';

@Resolver(MarketingLocation)
export class MarketingLocationResolver {
  constructor(
    private readonly marketingLocationService: MarketingLocationService
  ) {}

  @Query(() => MarketingLocation, {
    description: 'Look up a marketing location by its ID',
  })
  async marketingLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<MarketingLocation> {
    return await this.marketingLocationService.readOne(id, session);
  }

  @Query(() => MarketingLocationListOutput, {
    description: 'Look up marketing locations',
  })
  async marketingLocations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => MarketingLocationListInput,
      defaultValue: MarketingLocationListInput.defaultVal,
    })
    input: MarketingLocationListInput
  ): Promise<MarketingLocationListOutput> {
    return this.marketingLocationService.list(input, session);
  }

  @Mutation(() => CreateMarketingLocationOutput, {
    description: 'Create a marketing location',
  })
  async createMarketingLocation(
    @Session() session: ISession,
    @Args('input') { marketingLocation: input }: CreateMarketingLocationInput
  ): Promise<CreateMarketingLocationOutput> {
    const marketingLocation = await this.marketingLocationService.create(
      input,
      session
    );
    return { marketingLocation };
  }

  @Mutation(() => UpdateMarketingLocationOutput, {
    description: 'Update a marketing location',
  })
  async updateMarketingLocation(
    @Session() session: ISession,
    @Args('input') { marketingLocation: input }: UpdateMarketingLocationInput
  ): Promise<UpdateMarketingLocationOutput> {
    const marketingLocation = await this.marketingLocationService.update(
      input,
      session
    );
    return { marketingLocation };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a funding account',
  })
  async deleteMarketingLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.marketingLocationService.delete(id, session);
    return true;
  }
}
