import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { UnavailabilityLoader, UnavailabilityService } from '../unavailability';
import {
  CreateUnavailability,
  CreateUnavailabilityOutput,
  DeleteUnavailabilityOutput,
  Unavailability,
  UnavailabilityListInput,
  UnavailabilityListOutput,
  UpdateUnavailability,
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
    @ListArg(UnavailabilityListInput) input: UnavailabilityListInput,
    @Loader(UnavailabilityLoader)
    unavailabilities: LoaderOf<UnavailabilityLoader>,
  ): Promise<UnavailabilityListOutput> {
    const list = await this.service.list(input);
    unavailabilities.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateUnavailabilityOutput, {
    description: 'Create an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async createUnavailability(
    @Args('input') input: CreateUnavailability,
  ): Promise<CreateUnavailabilityOutput> {
    const unavailability = await this.service.create(input);
    return { unavailability };
  }

  @Mutation(() => UpdateUnavailabilityOutput, {
    description: 'Update an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async updateUnavailability(
    @Args('input') input: UpdateUnavailability,
  ): Promise<UpdateUnavailabilityOutput> {
    const unavailability = await this.service.update(input);
    return { unavailability };
  }

  @Mutation(() => DeleteUnavailabilityOutput, {
    description: 'Delete an unavailability',
    deprecationReason: `This is unfinished functionality, don't use`,
  })
  async deleteUnavailability(
    @IdArg() id: ID,
  ): Promise<DeleteUnavailabilityOutput> {
    await this.service.delete(id);
    return { success: true };
  }
}
