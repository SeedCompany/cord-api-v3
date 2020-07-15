import { Injectable } from '@nestjs/common';
import { ISession, NotImplementedException } from '../../common';
import {
  CreateSong,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSong,
} from './dto';

// TODO Remove when implementing
/* eslint-disable @seedcompany/no-unused-vars */

@Injectable()
export class SongService {
  async readOne(id: string, session: ISession): Promise<Song> {
    throw new NotImplementedException();
  }

  async list(input: SongListInput, session: ISession): Promise<SongListOutput> {
    throw new NotImplementedException();
  }

  async create(input: CreateSong, session: ISession): Promise<Song> {
    throw new NotImplementedException();
  }

  async update(input: UpdateSong, session: ISession): Promise<Song> {
    throw new NotImplementedException();
  }

  async delete(id: string, session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
