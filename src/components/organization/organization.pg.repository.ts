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
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  UpdateOrganization,
} from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class PgOrganizationRepository
  implements PublicOf<OrganizationRepository>
{
  constructor(private readonly pg: Pg) {}

  @PgTransaction()
  async create(input: CreateOrganization, _session: Session) {
    // TODO: Add primary_location
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO common.organizations(
          name, street_address, created_by_admin_people_id, modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES ($1, $2, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id; 
      `,
      [input.name, input.address]
    );

    if (!id) {
      throw new ServerException('Failed to create organization');
    }

    return id;
  }

  async readOne(
    id: ID,
    _session: Session
  ): Promise<UnsecuredDto<Organization>> {
    const rows = await this.pg.query<UnsecuredDto<Organization>>(
      `
      SELECT 
        id, name, sensitivity, created_at as "createdAt",
        concat_ws(', ', street_address, city, state, nation) as address
      FROM common.organizations
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find organization ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session
  ): Promise<ReadonlyArray<UnsecuredDto<Organization>>> {
    const rows = await this.pg.query<UnsecuredDto<Organization>>(
      `
      SELECT 
        id, name, sensitivity, created_at as "createdAt",
        concat_ws(', ', street_address, city, state, nation) as address
      FROM common.organizations
      WHERE id = ANY($1::text[])
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: OrganizationListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<Organization>>> {
    // TODO: Match AuthSensitivityMapping
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM common.organizations
      `
    );

    const rows = await this.pg.query<UnsecuredDto<Organization>>(
      `
      SELECT 
        id, name, sensitivity, created_at as "createdAt",
        concat_ws(', ', street_address, city, state, nation) as address
      FROM common.organizations   
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const organizationList: PaginatedListType<UnsecuredDto<Organization>> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return organizationList;
  }

  async update(input: UpdateOrganization) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    // Hardcoding updates only for `street_address` and  `name` for now
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        return key === 'address'
          ? `street_address = '${value as string}'`
          : `${key} = '${value as string}'`;
      })
      .join(', ');

    const rows = await this.pg.query(
      `
      UPDATE common.organizations SET ${updates}, modified_at = CURRENT_TIMESTAMP, 
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new ServerException(`Could not update location ${id}`);
    }

    return rows[0];
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query('DELETE FROM common.organizations WHERE id = $1;', [
      id,
    ]);
  }

  async isUnique(orgName: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS (SELECT name FROM common.organizations WHERE name = $1);`,
      [orgName]
    );

    return !exists;
  }

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Organization>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof Organization>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<Organization>,
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
