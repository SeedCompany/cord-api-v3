import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateSongInput,
  CreateSongOutput,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSongInput,
  UpdateSongOutput,
} from './dto';
import { SongService } from './song.service';

@Resolver(Song)
export class SongResolver {
  constructor(private readonly storyService: SongService) {}

  @Query(() => Song, {
    description: 'Look up a song by its ID',
  })
  async song(@Session() session: ISession, @IdArg() id: string): Promise<Song> {
    return await this.storyService.readOne(id, session);
  }

  @Query(() => SongListOutput, {
    description: 'Look up stories',
  })
  async songs(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => SongListInput,
      defaultValue: SongListInput.defaultVal,
    })
    input: SongListInput
  ): Promise<SongListOutput> {
    return this.storyService.list(input, session);
  }

  @Mutation(() => CreateSongOutput, {
    description: 'Create a song',
  })
  async createSong(
    @Session() session: ISession,
    @Args('input') { song: input }: CreateSongInput
  ): Promise<CreateSongOutput> {
    const song = await this.storyService.create(input, session);
    return { song };
  }

  @Mutation(() => UpdateSongOutput, {
    description: 'Update a song',
  })
  async updateSong(
    @Session() session: ISession,
    @Args('input') { song: input }: UpdateSongInput
  ): Promise<UpdateSongOutput> {
    const song = await this.storyService.update(input, session);
    return { song };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a song',
  })
  async deleteSong(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.storyService.delete(id, session);
    return true;
  }
}
