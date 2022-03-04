import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import { CreateFieldZone, FieldZone, FieldZoneListInput } from './dto';

@Injectable()
export class FieldZoneRepository extends DtoRepository(FieldZone) {
  async create(input: CreateFieldZone, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };

    // create field zone
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(FieldZone, { initialProps }))
      .apply(
        createRelationships(FieldZone, 'out', {
          director: ['User', input.directorId],
        })
      )
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'director', ACTIVE),
          node('director', 'User'),
        ])
        .return<{ dto: UnsecuredDto<FieldZone> }>(
          merge('props', {
            director: 'director.id',
          }).as('dto')
        );
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
        relation('out', 'oldRel', 'director', ACTIVE),
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

  async list({ filter, ...input }: FieldZoneListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'FieldZone'))
      .apply(sorting(FieldZone, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}

@Injectable()
export class PgFieldZoneRepository implements PublicOf<FieldZoneRepository> {
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateFieldZone,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.field_zones(name, director, created_by, modified_by, owning_person, owning_group)
      VALUES($1, $2, (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.name, input.directorId]
    );

    if (!id) {
      throw new ServerException('Failed to create field zone');
    }

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<FieldZone>> {
    const rows = await this.pg.query<UnsecuredDto<FieldZone>>(
      `
      SELECT id, name, director, created_at as  "createdAt"
      FROM sc.field_zones
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find field zone ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<FieldZone>>> {
    const rows = await this.pg.query<UnsecuredDto<FieldZone>>(
      `
      SELECT id, name, director, created_at as "createdAt"
      FROM sc.field_zones
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async updateDirector(directorId: ID, id: ID): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.field_zones SET director = (SELECT id FROM admin.people WHERE id = $1)
      WHERE id = $2;
      `,
      [directorId, id]
    );
  }

  async updateName(name: string, id: ID) {
    await this.pg.query(
      `
      UPDATE sc.field_zones SET name = $1 WHERE id = $2;
      `,
      [name, id]
    );
  }

  async list(
    input: FieldZoneListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<FieldZone>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM sc.field_zones;'
    );

    const rows = await this.pg.query<UnsecuredDto<FieldZone>>(
      `
      SELECT id, name, director, created_at as "createdAt"
      FROM sc.field_zones
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    return {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query(
      `
      UPDATE sc.field_regions
      SET field_zone = (SELECT NULL FROM sc.field_zones WHERE id = $1)
      WHERE field_zone = $1;
      `,
      [id]
    );
    await this.pg.query('DELETE FROM sc.field_zones WHERE id = $1', [id]);
  }

  async isUnique(value: string, _label?: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS(SELECT name FROM sc.field_zones WHERE name = $1)
      `,
      [value]
    );

    return !exists;
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof FieldZone>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;

  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }
  updateProperties<
    TObject extends Partial<MaybeUnsecuredInstance<typeof FieldZone>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<FieldZone>,
    _changeset?: ID
  ): Promise<TObject> {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: Session | ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
