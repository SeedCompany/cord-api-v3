import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { EthnoArtLoader, EthnoArtService } from '../ethno-art';
import {
  CreateEthnoArt,
  EthnoArt,
  EthnoArtCreated,
  EthnoArtDeleted,
  EthnoArtListInput,
  EthnoArtListOutput,
  EthnoArtUpdated,
  UpdateEthnoArt,
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

  @Mutation(() => EthnoArtCreated, {
    description: 'Create an ethno art',
  })
  async createEthnoArt(
    @Args('input') input: CreateEthnoArt,
  ): Promise<EthnoArtCreated> {
    const ethnoArt = await this.ethnoArtService.create(input);
    return { ethnoArt };
  }

  @Mutation(() => EthnoArtUpdated, {
    description: 'Update an ethno art',
  })
  async updateEthnoArt(
    @Args('input') input: UpdateEthnoArt,
  ): Promise<EthnoArtUpdated> {
    const ethnoArt = await this.ethnoArtService.update(input);
    return { ethnoArt };
  }

  @Mutation(() => EthnoArtDeleted, {
    description: 'Delete an ethno art',
  })
  async deleteEthnoArt(@IdArg() id: ID): Promise<EthnoArtDeleted> {
    await this.ethnoArtService.delete(id);
    return {};
  }
}
