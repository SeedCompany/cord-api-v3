import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  DeleteEthnoArtOutput,
  EthnoArtLoader,
  EthnoArtService,
} from '../ethno-art';
import {
  CreateEthnoArtInput,
  CreateEthnoArtOutput,
  EthnoArt,
  EthnoArtListInput,
  EthnoArtListOutput,
  UpdateEthnoArtInput,
  UpdateEthnoArtOutput,
} from './dto';

@Resolver(EthnoArt)
export class EthnoArtResolver {
  constructor(private readonly ethnoArtService: EthnoArtService) {}

  @Query(() => EthnoArt, {
    description: 'Look up an ethno art',
  })
  async ethnoArt(
    @IdArg() id: ID,
    @Loader(EthnoArtLoader) ethnoArts: LoaderOf<EthnoArtLoader>
  ): Promise<EthnoArt> {
    return await ethnoArts.load(id);
  }

  @Query(() => EthnoArtListOutput, {
    description: 'Look up ethno arts',
  })
  async ethnoArts(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => EthnoArtListInput,
      defaultValue: EthnoArtListInput.defaultVal,
    })
    input: EthnoArtListInput,
    @Loader(EthnoArtLoader) ethnoArts: LoaderOf<EthnoArtLoader>
  ): Promise<EthnoArtListOutput> {
    const list = await this.ethnoArtService.list(input, session);
    ethnoArts.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateEthnoArtOutput, {
    description: 'Create an ethno art',
  })
  async createEthnoArt(
    @LoggedInSession() session: Session,
    @Args('input') { ethnoArt: input }: CreateEthnoArtInput
  ): Promise<CreateEthnoArtOutput> {
    const ethnoArt = await this.ethnoArtService.create(input, session);
    return { ethnoArt };
  }

  @Mutation(() => UpdateEthnoArtOutput, {
    description: 'Update an ethno art',
  })
  async updateEthnoArt(
    @LoggedInSession() session: Session,
    @Args('input') { ethnoArt: input }: UpdateEthnoArtInput
  ): Promise<UpdateEthnoArtOutput> {
    const ethnoArt = await this.ethnoArtService.update(input, session);
    return { ethnoArt };
  }

  @Mutation(() => DeleteEthnoArtOutput, {
    description: 'Delete an ethno art',
  })
  async deleteEthnoArt(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteEthnoArtOutput> {
    await this.ethnoArtService.delete(id, session);
    return { success: true };
  }
}
