import { Injectable } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { IdArg, RequestUser } from '../../../common';
import {
  CreateUnavailabilityInput,
  CreateUnavailabilityOutput,
  UpdateUnavailabilityInput,
  UpdateUnavailabilityOutput,
} from './dto';
import { UnavailabilityService } from './unavailability.service';

@Injectable()
export class UnavailabilityResolver {
  constructor(private readonly service: UnavailabilityService) {}

  @Mutation(() => CreateUnavailabilityOutput, {
    description: 'Create an unavailability',
  })
  async createUnavailability(
    @RequestUser() token: string,
    @Args('input') { unavailability: input }: CreateUnavailabilityInput,
  ): Promise<CreateUnavailabilityOutput> {
    const unavailability = await this.service.create(input, token);
    return { unavailability };
  }

  @Mutation(() => UpdateUnavailabilityOutput, {
    description: 'Update an unavailability',
  })
  async updateUnavailability(
    @RequestUser() token: string,
    @Args('input') { unavailability: input }: UpdateUnavailabilityInput,
  ): Promise<UpdateUnavailabilityOutput> {
    const unavailability = await this.service.update(input, token);
    return { unavailability };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an unavailability',
  })
  async deleteUnavailability(
    @RequestUser() token: string,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.service.delete(id, token);
    return true;
  }
}
