import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Song } from './dto';
import { SongService } from './song.service';

@Injectable({ scope: Scope.REQUEST })
export class SongLoader extends OrderedNestDataLoader<Song> {
  constructor(private readonly songs: SongService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.songs.readMany(ids, this.session);
  }
}
