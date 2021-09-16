import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';

import {
  ID,
  isIdLike,
  NotFoundException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  DatabaseService,
  DtoRepository,
  matchRequestingUser,
  PostgresService,
} from '../../core';
import {
  ACTIVE,
  createNode,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  rankSens,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateOrganization, Organization, OrganizationListInput } from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository(Organization) {
  constructor(db: DatabaseService, private readonly pg: PostgresService) {
    super(db);
  }
  async checkOrg(name: string) {
    return await this.db
      .query()
      .match([node('org', 'OrgName', { value: name })])
      .return('org')
      .first();
  }

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

  async readOne(orgId: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Organization', { id: orgId })])
      .apply(this.hydrate(session));

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find organization',
        'organization.id'
      );
    }

    const pool = await this.pg.pool;
    const orgData = await pool.query(
      `select name, created_at as "createdAt", neo4j_id as "id" from public.organizations_data 
      where neo4j_id = $1`,
      [orgId]
    );
    const pgResult = orgData.rows[0];
    console.log('neo4j Result: ', result.dto);
    console.log('pg Result: ', pgResult);
    return result.dto;
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
          }).as('dto')
        );
  }

  async list({ filter, ...input }: OrganizationListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Organization'),
        ...(filter.userId && session.userId
          ? [
              relation('in', '', 'organization', ACTIVE),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .apply(sorting(Organization, input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
