import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { EthnoArtLoader, EthnoArtService } from '../ethno-art';
import {
  CreateEthnoArt,
  CreateEthnoArtOutput,
  DeleteEthnoArtOutput,
  EthnoArt,
  EthnoArtListInput,
  EthnoArtListOutput,
  UpdateEthnoArt,
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
    @Loader(EthnoArtLoader) ethnoArts: LoaderOf<EthnoArtLoader>,
  ): Promise<EthnoArt> {
    return await ethnoArts.load(id);
  }

  @Query(() => EthnoArtListOutput, {
    description: 'Look up ethno arts',
  })
  async ethnoArts(
    @ListArg(EthnoArtListInput) input: EthnoArtListInput,
    @Loader(EthnoArtLoader) ethnoArts: LoaderOf<EthnoArtLoader>,
  ): Promise<EthnoArtListOutput> {
    const list = await this.ethnoArtService.list(input);
    ethnoArts.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateEthnoArtOutput, {
    description: 'Create an ethno art',
  })
  async createEthnoArt(
    @Args('input') input: CreateEthnoArt,
  ): Promise<CreateEthnoArtOutput> {
    const ethnoArt = await this.ethnoArtService.create(input);
    return { ethnoArt };
  }

  @Mutation(() => UpdateEthnoArtOutput, {
    description: 'Update an ethno art',
  })
  async updateEthnoArt(
    @Args('input') input: UpdateEthnoArt,
  ): Promise<UpdateEthnoArtOutput> {
    const ethnoArt = await this.ethnoArtService.update(input);
    return { ethnoArt };
  }

  @Mutation(() => DeleteEthnoArtOutput, {
    description: 'Delete an ethno art',
  })
  async deleteEthnoArt(@IdArg() id: ID): Promise<DeleteEthnoArtOutput> {
    await this.ethnoArtService.delete(id);
    return { success: true };
  }
}
