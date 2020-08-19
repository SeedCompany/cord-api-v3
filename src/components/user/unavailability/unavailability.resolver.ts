import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../../common';
import {
  CreateUnavailabilityInput,
  CreateUnavailabilityOutput,
  Unavailability,
  UnavailabilityListInput,
  UnavailabilityListOutput,
  UpdateUnavailabilityInput,
  UpdateUnavailabilityOutput,
} from './dto';
import { UnavailabilityService } from './unavailability.service';

@Resolver()
export class UnavailabilityResolver {
  constructor(private readonly service: UnavailabilityService) {}

  @Query(() => Unavailability, {
    description: 'Look up a unavailability by its ID',
  })
  async unavailability(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Unavailability> {
    return await this.service.readOne(id, session);
  }

  @Query(() => UnavailabilityListOutput, {
    description: 'Look up unavailabilities by user id',
  })
  async unavailabilities(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => UnavailabilityListInput,
      defaultValue: UnavailabilityListInput.defaultVal,
    })
    input: UnavailabilityListInput
  ): Promise<UnavailabilityListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => CreateUnavailabilityOutput, {
    description: 'Create an unavailability',
  })
  async createUnavailability(
    @Session() session: ISession,
    @Args('input') { unavailability: input }: CreateUnavailabilityInput
  ): Promise<CreateUnavailabilityOutput> {
    const unavailability = await this.service.create(input, session);
    return { unavailability };
  }

  @Mutation(() => UpdateUnavailabilityOutput, {
    description: 'Update an unavailability',
  })
  async updateUnavailability(
    @Session() session: ISession,
    @Args('input') { unavailability: input }: UpdateUnavailabilityInput
  ): Promise<UpdateUnavailabilityOutput> {
    const unavailability = await this.service.update(input, session);
    return { unavailability };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an unavailability',
  })
  async deleteUnavailability(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check Consistency across Unavailability Nodes',
  })
  async checkUnavailabilityConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.service.checkUnavailabilityConsistency(session);
  }
}
