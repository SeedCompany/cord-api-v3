import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  matchRequestingUser,
  merge,
  oncePerProject,
  paginate,
  rankSens,
  requestingUser,
  sorting,
} from '../../core/database/query';
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
      acronym: input.acronym,
      address: input.address,
      types: input.types ?? [],
      reach: input.reach ?? [],
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Organization, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async update(
    existing: Organization,
    changes: ChangesOf<Organization, UpdateOrganization>,
  ) {
    return await this.updateProperties(existing, changes);
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
            .return(`'High' as sensitivity`),
        )
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<Organization> }>(
          merge('props', {
            scope: 'scopedRoles',
            sensitivity: 'sensitivity',
          }).as('dto'),
        );
  }

  async list({ filter, ...input }: OrganizationListInput, session: Session) {
    const query = this.db
      .query()
      .matchNode('node', 'Organization')
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
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: (inner) => (query) =>
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
              .apply(oncePerProject(inner)),
        }),
      )
      .apply(sorting(Organization, input))
      .apply(paginate(input, this.hydrate(session)));
    return (await query.first())!; // result from paginate() will always have 1 row.
  }
}
