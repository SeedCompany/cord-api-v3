import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
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
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Song>>>();

    return await query.first();
  }

  list({ filter, ...input }: SongListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Song')])
      .apply(calculateTotalAndPaginateList(Song, input));
  }
}
