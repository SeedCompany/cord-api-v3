import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser, PostgresService } from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateOrganization, Organization, OrganizationListInput } from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository(Organization) {
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
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find organization',
        'organization.id'
      );
    }

    const pool = await PostgresService.pool;
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

  async list({ filter, ...input }: OrganizationListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Organization'),
        ...(filter.userId && session.userId
          ? [
              relation('in', '', 'organization', { active: true }),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .apply(sorting(Organization, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
