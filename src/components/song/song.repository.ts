import { Injectable } from '@nestjs/common';
import { node, Query } from 'cypher-query-builder';
import {
  generateId,
  ID,
  NotFoundException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  matchProps,
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

  async create(session: Session, secureProps: Property[]) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(await generateId(), ['Song', 'Producible'], secureProps)
      )
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

  private hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<Song> }>('props as dto');
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
