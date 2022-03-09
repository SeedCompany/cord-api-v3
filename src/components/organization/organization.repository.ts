import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
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
import { CreateOrganization, Organization, OrganizationListInput } from './dto';

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
