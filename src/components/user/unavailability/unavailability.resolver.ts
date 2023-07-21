import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../../common';
import { Loader, LoaderOf } from '../../../core';
import { UnavailabilityLoader, UnavailabilityService } from '../unavailability';
import {
  CreateUnavailabilityInput,
  CreateUnavailabilityOutput,
  DeleteUnavailabilityOutput,
  Unavailability,
  UnavailabilityListInput,
  UnavailabilityListOutput,
  UpdateUnavailabilityInput,
  UpdateUnavailabilityOutput,
} from './dto';

@Resolver()
export class UnavailabilityResolver {
  constructor(private readonly service: UnavailabilityService) {}

  @Query(() => Unavailability, {
    description: 'Look up a unavailability by its ID',
    deprecationReason: 'Query via user instead',
  })
  async unavailability(
    @Loader(UnavailabilityLoader)
    unavailabilities: LoaderOf<UnavailabilityLoader>,
    @IdArg() id: ID,
  ): Promise<Unavailability> {
    return await unavailabilities.load(id);
  }

  @Query(() => UnavailabilityListOutput, {
    description: 'Look up unavailabilities by user id',
    deprecationReason: 'Query via user instead',
  })
  async unavailabilities(
    @AnonSession() session: Session,
    @ListArg(UnavailabilityListInput) input: UnavailabilityListInput,
    @Loader(UnavailabilityLoader)
    unavailabilities: LoaderOf<UnavailabilityLoader>,
  ): Promise<UnavailabilityListOutput> {
    const list = await this.service.list(input, session);
    unavailabilities.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateUnavailabilityOutput, {
    description: 'Create an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async createUnavailability(
    @LoggedInSession() session: Session,
    @Args('input') { unavailability: input }: CreateUnavailabilityInput,
  ): Promise<CreateUnavailabilityOutput> {
    const unavailability = await this.service.create(input, session);
    return { unavailability };
  }

  @Mutation(() => UpdateUnavailabilityOutput, {
    description: 'Update an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async updateUnavailability(
    @LoggedInSession() session: Session,
    @Args('input') { unavailability: input }: UpdateUnavailabilityInput,
  ): Promise<UpdateUnavailabilityOutput> {
    const unavailability = await this.service.update(input, session);
    return { unavailability };
  }

  @Mutation(() => DeleteUnavailabilityOutput, {
    description: 'Delete an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async deleteUnavailability(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteUnavailabilityOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }
}
