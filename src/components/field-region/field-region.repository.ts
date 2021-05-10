import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';

import { Session, ID, generateId } from '../../common';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { FieldRegion, FieldRegionListInput, UpdateFieldRegion } from './dto';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbChanges } from '../../core/database/changes';
import { session } from 'neo4j-driver';

@Injectable()
export class FieldRegionRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkName(name: string) {
    return await this.db
      .query()
      .match([node('name', 'FieldRegionName', { value: name })])
      .return('name')
      .first();
  }

  async create(
    session: Session,
    name: string,
    directorId: ID,
    fieldZoneId: ID
  ) {
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'name',
        value: name,
        isPublic: false,
        isOrgPublic: false,
        label: 'FieldRegionName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create field region
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('director', 'User', {
          id: directorId,
        }),
      ])
      .match([
        node('fieldZone', 'FieldZone', {
          id: fieldZoneId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'FieldRegion', secureProps))
      .create([
        node('node'),
        relation('out', '', 'director', { active: true, createdAt }),
        node('director'),
      ])
      .create([
        node('node'),
        relation('out', '', 'zone', { active: true, createdAt }),
        node('fieldZone'),
      ])
      .return('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FieldRegion', { id: id })])
      .apply(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'zone', { active: true }),
        node('fieldZone', 'FieldZone'),
      ])
      .return(
        'propList, node, director.id as directorId, fieldZone.id as fieldZoneId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldRegion>> & {
          directorId: ID;
          fieldZoneId: ID;
        }
      >();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(fieldRegion: FieldRegion, input: UpdateFieldRegion) {
    return this.db.getActualChanges(FieldRegion, fieldRegion, input);
  }

  async updateProperties(
    fieldRegion: FieldRegion,
    changes: DbChanges<FieldRegion>
  ) {
    await this.db.updateProperties({
      type: FieldRegion,
      object: fieldRegion,
      changes: changes,
    });
  }

  async deleteNode(node: FieldRegion) {
    await this.db.deleteNode(node);
  }

  list({ filter, ...input }: FieldRegionListInput, session: Session) {
    const label = 'FieldRegion';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(FieldRegion, input));
    return query;
  }
}
