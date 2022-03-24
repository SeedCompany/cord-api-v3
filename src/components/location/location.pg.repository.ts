import { Injectable } from '@nestjs/common';
import { compact, isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
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
import {
  CreateLocation,
  Location,
  LocationListInput,
  UpdateLocation,
} from './dto';
import { LocationRepository } from './location.repository';

@Injectable()
export class PgLocationRepository implements PublicOf<LocationRepository> {
  constructor(readonly pg: Pg) {}
  async doesNameExist(name: string): Promise<boolean> {
    const rows = await this.pg.query(
      `
      SELECT name
      FROM common.locations
      WHERE name = $1;
      `,
      [name]
    );
    return !!rows[0];
  }

  async create(input: CreateLocation, _session: Session): Promise<ID> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      WITH common_location AS (
        INSERT INTO common.locations(
          name, type, iso_3166_alpha_3, created_by_admin_people_id,  modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id)
        VALUES($1, $2, $3, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators')) 
        RETURNING id as common_location_id
      )
      INSERT INTO sc.locations(
        id, default_region, funding_account, 
        created_by_admin_people_id, modified_by_admin_people_id, 
        owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES((SELECT common_location_id FROM common_location), $4, $5,
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id
      `,
      [
        input.name,
        input.type,
        input.isoAlpha3,
        input.defaultFieldRegionId,
        input.fundingAccountId,
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create location');
    }

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<Location>> {
    const rows = await this.pg.query<UnsecuredDto<Location>>(
      `
      SELECT 
          s.id, c.name, c.type, c.iso_3166_alpha_3 as "isoAlpha3", s.funding_account as "fundingAccount", 
          default_region as "defaultFieldRegion", s.created_at as "createdAt" 
      FROM sc.locations s, common.locations c
      WHERE c.id = $1 AND s.id = c.id;
      `,
      [id]
    );

    return rows[0];
  }

  async readMany(
    ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<Location>>> {
    const rows = await this.pg.query<UnsecuredDto<Location>>(
      `
      SELECT 
          c.id, c.name, c.type, c.iso_3166_alpha_3 as "isoAlpha3", s.funding_account as "fundingAccount",
          s.default_region as "defaultFieldRegion", s.created_at as "createdAt"
      FROM sc.locations s, common.locations c
      WHERE c.id = ANY($1::text[]) AND s.id = c.id;
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: LocationListInput
  ): Promise<PaginatedListType<UnsecuredDto<Location>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM common.locations;'
    );

    const rows = await this.pg.query<UnsecuredDto<Location>>(
      `
      SELECT 
          c.id, c.name, c.type, c.iso_3166_alpha_3 as "isoAlpha3", s.funding_account as "fundingAccount",
          s.default_region as "defaultFieldRegion", s.created_at as "createdAt"
      FROM sc.locations
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const locationList: PaginatedListType<UnsecuredDto<Location>> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return locationList;
  }

  async update(input: UpdateLocation) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const scUpdates = compact(
      Object.keys(changes).map((key) =>
        key === 'defaultFieldRegionId'
          ? `default_region = (SELECT id FROM sc.field_regions WHERE id = '${
              changes.defaultFieldRegionId as string
            }')`
          : key === 'fundingAccountId'
          ? `funding_account = (SELECT id FROM sc.funding_accounts WHERE id = '${
              changes.fundingAccountId as string
            }')`
          : null
      )
    ).join(', ');

    const commonUpdates = compact(
      Object.keys(changes).map((key) =>
        key === 'isoAlpha3'
          ? `iso_3166_alpha_3 = '${changes.isoAlpha3 as string}'`
          : `${key} = '${
              changes[key as keyof Omit<UpdateLocation, 'id'>] as string
            }'`
      )
    ).join(', ');

    commonUpdates &&
      (await this.pg.query(
        `
        UPDATE common.locations SET ${commonUpdates}, modified_at = CURRENT_TIMESTAMP,
        modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
        WHERE id = $1
        `,
        [id]
      ));

    scUpdates &&
      (await this.pg.query(
        `
        UPDATE sc.locations SET ${scUpdates}, modified_at = CURRENT_TIMESTAMP,
        modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
        WHERE id = $1;
        `,
        [id]
      ));
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.locations WHERE id = $1;', [id]);
    await this.pg.query('DELETE FROM common.locations WHERE id = $1;', [id]);
  }

  async isUnique(locationName: string, _label?: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS (SELECT name FROM common.locations WHERE name = $1);`,
      [locationName]
    );

    return !exists;
  }

  addLocationToNode(
    _label: string,
    _id: ID,
    _rel: string,
    _locationId: ID
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  removeLocationFromNode(
    _label: string,
    _id: ID,
    _rel: string,
    _locationId: ID
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  listLocationsFromNodeNoSecGroups(
    _label: string,
    _rel: string,
    _id: ID,
    _input: LocationListInput
  ): Promise<PaginatedListType<UnsecuredDto<Location>>> {
    throw new Error('Method not implemented.');
  }
  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Location>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof Location>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<Location>,
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
