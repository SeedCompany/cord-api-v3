import { Injectable } from '@nestjs/common';
import { isEmpty, isNil, omitBy } from 'lodash';
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
import {
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  UpdateFieldRegion,
} from './dto';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class PgFieldRegionRepository
  implements PublicOf<FieldRegionRepository>
{
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateFieldRegion,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.field_regions(
          name, director_admin_people_id, sc_field_zone_id, created_by_admin_people_id, 
          modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, (SELECT id FROM sc.field_zones WHERE id = $3),
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [input.name, input.directorId, input.fieldZoneId]
    );

    if (!id) {
      throw new ServerException('Failed to create field region');
    }

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<FieldRegion>> {
    const rows = await this.pg.query<UnsecuredDto<FieldRegion>>(
      `
      SELECT 
          id, name, director_admin_people_id as director, 
          sc_field_zone_id as "fieldZone", created_at as "createdAt"
      FROM sc.field_regions
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find field region ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<FieldRegion>>> {
    const rows = await this.pg.query<UnsecuredDto<FieldRegion>>(
      `
      SELECT 
          id, name, director_admin_people_id as director, 
          sc_field_zone_id as "fieldZone", created_at as "createdAt"
      FROM sc.field_regions
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: FieldRegionListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<FieldRegion>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM sc.field_regions;'
    );

    const rows = await this.pg.query<UnsecuredDto<FieldRegion>>(
      `
      SELECT 
          id, name, director_admin_people_id as director, 
          sc_field_zone_id as "fieldZone", created_at as "createdAt"
      FROM sc.field_regions
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

  async isUnique(value: string, _label?: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS(SELECT name FROM sc.field_regions WHERE name = $1)
      `,
      [value]
    );

    return !exists;
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.field_regions WHERE id = $1', [id]);
  }

  async update(input: UpdateFieldRegion) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const updates = Object.keys(changes)
      .map((key) =>
        key === 'directorId'
          ? `director_admin_people_id = (SELECT id FROM admin.people WHERE id = '${
              changes.directorId as string
            }')`
          : key === 'fieldZoneId'
          ? `sc_field_zone_id = (SELECT id FROM sc.field_zones WHERE id = '${
              changes.fieldZoneId as string
            }')`
          : `${key} = '${
              changes[key as keyof Omit<UpdateFieldRegion, 'id'>] as string
            }'`
      )
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.field_regions SET ${updates}, modified_at = CURRENT_TIMESTAMP, 
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof FieldRegion>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof FieldRegion>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<FieldRegion>,
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
