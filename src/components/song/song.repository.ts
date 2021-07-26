import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateSong, Song, SongListInput } from './dto';

@Injectable()
export class SongRepository extends DtoRepository(Song) {
  async checkSong(input: CreateSong) {
    return await this.db
      .query()
      .match([node('song', 'SongName', { value: input.name })])
      .return('song')
      .first();
  }

  async create(input: CreateSong, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Song, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Song', { id })])
      .apply(this.hydrate());
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find song', 'song.id');
    }
    return result.dto;
  }

  async list({ filter, ...input }: SongListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Song')])
      .apply(sorting(Song, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
