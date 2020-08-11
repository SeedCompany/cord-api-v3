import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreatePublicLocationInput,
  CreatePublicLocationOutput,
  PublicLocation,
  PublicLocationListInput,
  PublicLocationListOutput,
} from './dto';
import { PublicLocationService } from './public-location.service';

@Resolver(PublicLocation)
export class PublicLocationResolver {
  constructor(private readonly publicLocationService: PublicLocationService) {}

  @Query(() => PublicLocation, {
    description: 'Look up a public location by its ID',
  })
  async publicLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<PublicLocation> {
    return this.publicLocationService.readOne(id, session);
  }

  @Query(() => PublicLocationListOutput, {
    description: 'Look up public locations',
  })
  async publicLocations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => PublicLocationListInput,
      defaultValue: PublicLocationListInput.defaultVal,
    })
    input: PublicLocationListInput
  ): Promise<PublicLocationListOutput> {
    return this.publicLocationService.list(input, session);
  }

  @Mutation(() => CreatePublicLocationOutput, {
    description: 'Create a public location',
  })
  async createPublicLocation(
    @Session() session: ISession,
    @Args('input') { publicLocation: input }: CreatePublicLocationInput
  ): Promise<CreatePublicLocationOutput> {
    const publicLocation = await this.publicLocationService.create(
      input,
      session
    );
    return { publicLocation };
  }

  // @Mutation(() => UpdatePublicLocationOutput, {
  //   description: 'Update a private location',
  // })
  // async updatePublicLocation(
  //   @Session() session: ISession,
  //   @Args('input') { publicLocation: input }: UpdatePublicLocationInput
  // ): Promise<UpdatePublicLocationOutput> {
  //   const publicLocation = await this.publicLocationService.update(
  //     input,
  //     session
  //   );
  //   return { publicLocation };
  // }

  @Mutation(() => Boolean, {
    description: 'Delete a private location',
  })
  async deletePublicLocation(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.publicLocationService.delete(id, session);
    return true;
  }
}
