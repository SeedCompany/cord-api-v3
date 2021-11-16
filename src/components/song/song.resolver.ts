import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { EthnoArtLoader, EthnoArtService } from '../ethno-art';
import {
  CreateSongInput,
  CreateSongOutput,
  DeleteSongOutput,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSongInput,
  UpdateSongOutput,
} from './dto';

@Resolver(Song)
export class SongResolver {
  constructor(private readonly ethnoArts: EthnoArtService) {}

  @Query(() => Song, {
    description: 'Look up a song by its ID',
    deprecationReason: 'Use `ethnoArt` instead',
  })
  async song(
    @Loader(EthnoArtLoader) arts: LoaderOf<EthnoArtLoader>,
    @IdArg() id: ID
  ): Promise<Song> {
    return await arts.load(id);
  }

  @Query(() => SongListOutput, {
    description: 'Look up songs',
    deprecationReason: 'Use `ethnoArts` instead',
  })
  async songs(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => SongListInput,
      defaultValue: SongListInput.defaultVal,
    })
    input: SongListInput,
    @Loader(EthnoArtLoader) arts: LoaderOf<EthnoArtLoader>
  ): Promise<SongListOutput> {
    const list = await this.ethnoArts.list(input, session);
    arts.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateSongOutput, {
    description: 'Create a song',
    deprecationReason: 'Use `createEthnoArt` instead',
  })
  async createSong(
    @LoggedInSession() session: Session,
    @Args('input') { song: input }: CreateSongInput
  ): Promise<CreateSongOutput> {
    const song = await this.ethnoArts.create(input, session);
    return { song };
  }

  @Mutation(() => UpdateSongOutput, {
    description: 'Update a song',
    deprecationReason: 'Use `updateEthnoArt` instead',
  })
  async updateSong(
    @LoggedInSession() session: Session,
    @Args('input') { song: input }: UpdateSongInput
  ): Promise<UpdateSongOutput> {
    const song = await this.ethnoArts.update(input, session);
    return { song };
  }

  @Mutation(() => DeleteSongOutput, {
    description: 'Delete a song',
    deprecationReason: 'Use `deleteEthnoArt` instead',
  })
  async deleteSong(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteSongOutput> {
    await this.ethnoArts.delete(id, session);
    return { success: true };
  }
}
