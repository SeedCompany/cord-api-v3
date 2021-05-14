import { Injectable } from '@nestjs/common';
import { Node, node, regexp, Relation, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';

import {
  CalendarDate,
  generateId,
  ID,
  Sensitivity,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  Property,
  property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  collect,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  BaseNode,
  PropListDbResult,
  StandardReadResult,
} from '../../core/database/results';
import { CreateSong, Song, SongListInput, UpdateSong } from './dto';

@Injectable()
export class SongRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkSong(input: CreateSong, session: Session) {
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
      .return('node.id as id')
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

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(song: Song, input: UpdateSong) {
    return this.db.getActualChanges(Song, song, input);
  }

  async updateProperties(song: Song, simpleChanges: DbChanges<Song>) {
    await this.db.updateProperties({
      type: Song,
      object: song,
      changes: simpleChanges,
    });
  }

  async deleteNode(node: Song) {
    return await this.db.deleteNode(node);
  }

  list({ filter, ...input }: SongListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Song')])
      .apply(calculateTotalAndPaginateList(Song, input));
  }
}
