import { Injectable } from '@nestjs/common';
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
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import { CreateFieldZone, FieldZone, FieldZoneListInput } from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class PgFieldZoneRepository implements PublicOf<FieldZoneRepository> {
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateFieldZone,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.field_zones(
          name, director_admin_people_id, created_by_admin_people_id, modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'),
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
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
      SELECT id, name, director_admin_people_id as director, created_at as  "createdAt"
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
      SELECT id, name, director_admin_people_id as director, created_at as "createdAt"
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
      UPDATE sc.field_zones SET director_admin_people_id = (SELECT id FROM admin.people WHERE id = $1)
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
      SELECT id, name, director_admin_people_id as director, created_at as "createdAt"
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
      SET sc_field_zone_id = (SELECT NULL FROM sc.field_zones WHERE id = $1)
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
