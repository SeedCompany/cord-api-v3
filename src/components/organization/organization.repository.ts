import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
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
import { DtoRepository, Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import {
  ACTIVE,
  createNode,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProjectSensToLimitedScopeMap,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  rankSens,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { BaseNode } from '../../core/database/results';
import { PgTransaction } from '../../core/postgres/transaction.decorator';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository<
  typeof Organization,
  [session: Session]
>(Organization) {
  async create(input: CreateOrganization, session: Session) {
    const initialProps = {
      name: input.name,
      address: input.address,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Organization, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('project', 'Project'),
          relation('out', '', 'partnership'),
          node('', 'Partnership'),
          relation('out', '', 'partner'),
          node('', 'Partner'),
          relation('out', 'organization'),
          node('node'),
        ])
        .apply(matchProjectScopedRoles({ session }))
        .with([
          'node',
          'collect(project) as projList',
          'keys(apoc.coll.frequenciesAsMap(apoc.coll.flatten(collect(scopedRoles)))) as scopedRoles',
        ])
        .subQuery((sub) =>
          sub
            .with('projList')
            .raw('UNWIND projList as project')
            .apply(matchProjectSens())
            .with('sensitivity')
            .orderBy(rankSens('sensitivity'), 'ASC')
            .raw('LIMIT 1')
            .return('sensitivity')
            .union()
            .with('projList')
            .with('projList')
            .raw('WHERE size(projList) = 0')
            .return(`'High' as sensitivity`)
        )
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<Organization> }>(
          merge('props', {
            scope: 'scopedRoles',
            sensitivity: 'sensitivity',
          }).as('dto')
        );
  }

  async list(
    { filter, ...input }: OrganizationListInput,
    session: Session,
    limitedScope?: AuthSensitivityMapping
  ) {
    const result = this.db
      .query()
      .matchNode('node', 'Organization')
      .optionalMatch([
        ...(limitedScope
          ? [
              node('project', 'Project'),
              relation('out', '', 'partnership'),
              node('', 'Partnership'),
              relation('out', '', 'partner'),
              node('', 'Partner'),
              relation('out', 'organization'),
              node('node'),
            ]
          : []),
      ])
      .match([
        ...(filter.userId && session.userId
          ? [
              node('node'),
              relation('in', '', 'organization', ACTIVE),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .match(requestingUser(session))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(sorting(Organization, input))
      .apply(paginate(input, this.hydrate(session)))
      .logIt();
    return await result.first()!; // result from paginate() will always have 1 row.
  }
}

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
      WITH common_organization AS (
        INSERT INTO common.organizations(
            name, created_by, modified_by, owning_person, owning_group)
        VALUES (
            $1, (SELECT person FROM admin.tokens WHERE token = 'public'), 
            (SELECT person FROM admin.tokens WHERE token = 'public'), 
            (SELECT person FROM admin.tokens WHERE token = 'public'), 
            (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id AS common_id, sensitivity as common_sensitivity
      )
      INSERT INTO sc.organizations(
          id, address, sensitivity, created_by, modified_by, 
          owning_person, owning_group)
      VALUES (
          (SELECT common_id FROM common_organization), $2,
          (SELECT common_sensitivity FROM common_organization),
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
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
      SELECT c.id, c.name, s.address, c.sensitivity, c.created_at as "createdAt" 
      FROM common.organizations c, sc.organizations s
      WHERE c.id = s.id AND c.id = $1;
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
      SELECT c.id, c.name, s.address, c.sensitivity, c.created_at as "createdAt"
      FROM common.organizations c, sc.organizations s
      WHERE c.id = s.id AND c.id = ANY($1::text[])
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: OrganizationListInput,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<Organization>>> {
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM common.organizations c, sc.organizations s
      WHERE c.id = s.id;
      `
    );

    const rows = await this.pg.query<UnsecuredDto<Organization>>(
      `
      SELECT c.id, c.name, s.address, c.sensitivity, c.created_at as "createdAt"
      FROM common.organizations c, sc.organizations s
      WHERE c.id = s.id
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

    Object.keys(changes).forEach((key) => async () => {
      await this.pg.query(
        `
        UPDATE ${
          key === 'name' ? 'common' : 'sc'
        }.organizations, modified_at = CURRENT_TIMESTAMP, 
        modified_by = (SELECT person FROM admin.tokens WHERE token = 'public') 
        SET ${key} = $1 WHERE id = $2;
        `,
        [changes[key], id]
      );
    });
  }

  @PgTransaction()
  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.organizations WHERE id = $1;', [id]);
    await this.pg.query('DELETE FROM common.organizations WHERE id = $1;', [
      id,
    ]);
  }

  async isUnique(orgName: string): Promise<boolean> {
    const rows = await this.pg.query(
      `
      SELECT c.name FROM common.organizations c, sc.organizations sc 
      WHERE c.name = $1 OR sc.name = $1`,
      [orgName]
    );
    return !!rows[0];
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
