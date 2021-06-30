import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  DtoRepository,
  matchRequestingUser,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { PostgresService } from '../../core/postgres/postgres.service';
import { FieldZone, FieldZoneListInput } from './dto';

@Injectable()
export class FieldZoneRepository extends DtoRepository(FieldZone) {
  constructor(db: DatabaseService, private readonly pg: PostgresService) {
    super(db);
  }

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
      .return<{ id: ID }>('node.id as id');

    const pgClient = await this.pg.connectedClient;
    await pgClient.query(
      'INSERT INTO sc_field_zone (director_sys_person_id, name) VALUES($1, $2)',
      [directorId, name]
    );
    await pgClient.end();

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

  async updateDirector(directorId: ID, id: ID) {
    const createdAt = DateTime.local();
    this.db
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
