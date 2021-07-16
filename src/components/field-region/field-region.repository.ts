import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  matchPropList,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { FieldRegion, FieldRegionListInput } from './dto';

@Injectable()
export class FieldRegionRepository extends DtoRepository(FieldRegion) {
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
      .return<{ id: ID }>('node.id as id');

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

  async list({ filter, ...input }: FieldRegionListInput, session: Session) {
    const label = 'FieldRegion';
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(sorting(FieldRegion, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
