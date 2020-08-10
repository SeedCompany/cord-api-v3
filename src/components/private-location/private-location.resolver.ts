import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreatePrivateLocationInput,
  CreatePrivateLocationOutput,
  PrivateLocation,
  PrivateLocationListInput,
  PrivateLocationListOutput,
  UpdatePrivateLocationInput,
  UpdatePrivateLocationOutput,
} from './dto';
import { PrivateLocationService } from './private-location.service';

@Resolver(PrivateLocation)
export class PrivateLocationResolver {
  constructor(
    private readonly privateLocationService: PrivateLocationService
  ) {}

  @Query(() => PrivateLocation, {
    description: 'Look up a private location by its ID',
  })
  async privateLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<PrivateLocation> {
    return this.privateLocationService.readOne(id, session);
  }

  @Query(() => PrivateLocationListOutput, {
    description: 'Look up private locations',
  })
  async privateLocations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => PrivateLocationListInput,
      defaultValue: PrivateLocationListInput.defaultVal,
    })
    input: PrivateLocationListInput
  ): Promise<PrivateLocationListOutput> {
    return this.privateLocationService.list(input, session);
  }

  @Mutation(() => CreatePrivateLocationOutput, {
    description: 'Create a private location',
  })
  async createPrivateLocation(
    @Session() session: ISession,
    @Args('input') { privateLocation: input }: CreatePrivateLocationInput
  ): Promise<CreatePrivateLocationOutput> {
    const privateLocation = await this.privateLocationService.create(
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
    const privateLocation = await this.privateLocationService.update(
      input,
      session
    );
    return { privateLocation };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a private location',
  })
  async deletePrivateLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.privateLocationService.delete(id, session);
    return true;
  }
}
