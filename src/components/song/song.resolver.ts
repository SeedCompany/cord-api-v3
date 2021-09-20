import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
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
  async song(@AnonSession() session: Session, @IdArg() id: ID): Promise<Song> {
    return await this.storyService.readOne(id, session);
  }

  @Query(() => SongListOutput, {
    description: 'Look up stories',
  })
  async songs(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => SongListInput,
      defaultValue: SongListInput.defaultVal,
    })
    input: SongListInput
  ): Promise<SongListOutput> {
    return await this.storyService.list(input, session);
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
