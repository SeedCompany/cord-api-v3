import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  CreateSongInput,
  CreateSongOutput,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSongInput,
  UpdateSongOutput,
} from './dto';
import { SongLoader } from './song.loader';
import { SongService } from './song.service';

@Resolver(Song)
export class SongResolver {
  constructor(private readonly storyService: SongService) {}

  @Query(() => Song, {
    description: 'Look up a song by its ID',
  })
  async song(
    @Loader(SongLoader) songs: LoaderOf<SongLoader>,
    @IdArg() id: ID
  ): Promise<Song> {
    return await songs.load(id);
  }

  @Query(() => SongListOutput, {
    description: 'Look up songs',
  })
  async songs(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => SongListInput,
      defaultValue: SongListInput.defaultVal,
    })
    input: SongListInput,
    @Loader(SongLoader) songs: LoaderOf<SongLoader>
  ): Promise<SongListOutput> {
    const list = await this.storyService.list(input, session);
    songs.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateSongOutput, {
    description: 'Create a song',
  })
  async createSong(
    @LoggedInSession() session: Session,
    @Args('input') { song: input }: CreateSongInput
  ): Promise<CreateSongOutput> {
    const song = await this.storyService.create(input, session);
    return { song };
  }

  @Mutation(() => UpdateSongOutput, {
    description: 'Update a song',
  })
  async updateSong(
    @LoggedInSession() session: Session,
    @Args('input') { song: input }: UpdateSongInput
  ): Promise<UpdateSongOutput> {
    const song = await this.storyService.update(input, session);
    return { song };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a song',
  })
  async deleteSong(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.storyService.delete(id, session);
    return true;
  }
}
