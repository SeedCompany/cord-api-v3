import { Injectable } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, RequestUser } from '../../../common';
import {
  CreateUnavailabilityInput,
  CreateUnavailabilityOutput,
  UpdateUnavailabilityInput,
  UpdateUnavailabilityOutput,
  UnavailabilityListInput,
  SecuredUnavailabilityList,
  Unavailability,
} from './dto';
import { UnavailabilityService } from './unavailability.service';
import { IRequestUser } from '../../../common/request-user.interface';

@Resolver()
export class UnavailabilityResolver {
  constructor(private readonly service: UnavailabilityService) {}

  @Query(() => Unavailability, {
    description: 'Look up a unavailability by its ID',
  })
  async unavailability(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<Unavailability> {
    return await this.service.readOne(id, token);
  }

  // @Query(() => SecuredUnavailabilityList, {
  //   description: 'Look up unavailabilities for a user',
  // })
  // async unavailabilities(
  //   @RequestUser() token: IRequestUser,
  //   @Args({
  //     userId: 'id',
  //     type: () => UnavailabilityListInput,
  //     defaultValue: UnavailabilityListInput.defaultVal,
  //   })
  //   input: UnavailabilityListInput,
  // ): Promise<SecuredUnavailabilityList> {
  //   return this.service.list(userId, input, token);
  // }

  @Mutation(() => CreateUnavailabilityOutput, {
    description: 'Create an unavailability',
  })
  async createUnavailability(
    @RequestUser() token: IRequestUser,
    @Args('input') { unavailability: input }: CreateUnavailabilityInput,
  ): Promise<CreateUnavailabilityOutput> {
    const unavailability = await this.service.create(input, token);
    return { unavailability };
  }

  @Mutation(() => UpdateUnavailabilityOutput, {
    description: 'Update an unavailability',
  })
  async updateUnavailability(
    @RequestUser() token: IRequestUser,
    @Args('input') { unavailability: input }: UpdateUnavailabilityInput,
  ): Promise<UpdateUnavailabilityOutput> {
    const unavailability = await this.service.update(input, token);
    return { unavailability };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an unavailability',
  })
  async deleteUnavailability(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, token);
    return true;
  }
}
