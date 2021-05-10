import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';

import { Session, ID, generateId } from '../../common';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';

import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbChanges } from '../../core/database/changes';
import { FieldZone, FieldZoneListInput, UpdateFieldZone } from './dto';

@Injectable()
export class FieldZoneRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkName(name: string) {
    return await this.db
      .query()
      .match([node('name', 'FieldZoneName', { value: name })])
      .return('name')
      .first();
  }

  async create(
    session: Session,
    name: string,
    directorId: ID
    // fieldZoneId: ID
  ) {
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'name',
        value: name,
        isPublic: false,
        isOrgPublic: false,
        label: 'FieldZoneName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create field zone
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('director', 'User', {
          id: directorId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'FieldZone', secureProps))
      .create([
        node('node'),
        relation('out', '', 'director', { active: true, createdAt }),
        node('director'),
      ])
      .return('node.id as id');

    // const result = await query.first();

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FieldZone', { id: id })])
      .apply(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .return('propList, node, director.id as directorId')
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldZone>> & {
          directorId: ID;
        }
      >();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(fieldZone: FieldZone, input: UpdateFieldZone) {
    return this.db.getActualChanges(FieldZone, fieldZone, input);
  }

  async updateDirector(directorId: ID, id: ID) {
    const createdAt = DateTime.local();
    const query = this.db
      .query()
      .match(node('fieldZone', 'FieldZone', { id }))
      .with('fieldZone')
      .limit(1)
      .match([node('director', 'User', { id: directorId })])
      .optionalMatch([
        node('fieldZone'),
        relation('out', 'oldRel', 'director', { active: true }),
        node(''),
      ])
      .setValues({ 'oldRel.active': false })
      .with('fieldZone, director')
      .limit(1)
      .create([
        node('fieldZone'),
        relation('out', '', 'director', {
          active: true,
          createdAt,
        }),
        node('director'),
      ]);

    await query.run();
  }

  async updateProperties(fieldZone: FieldZone, changes: DbChanges<FieldZone>) {
    await this.db.updateProperties({
      type: FieldZone,
      object: fieldZone,
      changes: changes,
    });
  }

  async deleteNode(node: FieldZone) {
    await this.db.deleteNode(node);
  }

  list({ filter, ...input }: FieldZoneListInput, session: Session) {
    const label = 'FieldZone';
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(FieldZone, input));
    // return query;
  }
}
