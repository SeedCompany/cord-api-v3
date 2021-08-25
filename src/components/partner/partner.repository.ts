import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  isIdLike,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  paginate,
  rankSens,
  requestingUser,
  sorting,
  variable,
} from '../../core/database/query';
import { RoleSensitivityMapping } from '../authorization/authorization.service';
import { CreatePartner, Partner, PartnerListInput } from './dto';

@Injectable()
export class PartnerRepository extends DtoRepository(Partner) {
  async partnerIdByOrg(organizationId: ID) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Organization', { id: organizationId }),
        relation('in', '', 'organization', ACTIVE),
        node('partner', 'Partner'),
      ])
      .return<{ id: ID }>('partner.id as id')
      .first();
    return result?.id;
  }

  async create(input: CreatePartner, session: Session) {
    const initialProps = {
      types: input.types,
      financialReportingTypes: input.financialReportingTypes,
      pmcEntityCode: input.pmcEntityCode,
      globalInnovationsClient: input.globalInnovationsClient,
      active: input.active,
      address: input.address,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Partner, { initialProps }))
      .apply(
        createRelationships(Partner, 'out', {
          organization: ['Organization', input.organizationId],
          pointOfContact: ['User', input.pointOfContactId],
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create partner');
    }
    return result.id;
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Partner', { id: id })])
      .apply(this.hydrate(session));

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find partner');
    }

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
            // TODO: have this match from line 92 so we don't have to match this twice
            .match([
              node('project'),
              relation('out', '', 'member'),
              node('projectMember'),
              relation('out', '', 'user'),
              node('user', 'User', {
                id: isIdLike(session) ? session : session.userId,
              }),
            ])
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
        .optionalMatch([
          node('node'),
          relation('out', '', 'organization', ACTIVE),
          node('organization', 'Organization'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'pointOfContact', ACTIVE),
          node('pointOfContact', 'User'),
        ])
        .return<{ dto: UnsecuredDto<Partner> }>(
          merge('props', {
            sensitivity: 'sensitivity',
            organization: 'organization.id',
            pointOfContact: 'pointOfContact.id',
            scope: 'scopedRoles',
          }).as('dto')
        );
  }

  async updatePointOfContact(id: ID, user: ID, session: Session) {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('partner', 'Partner', { id })
      .matchNode('newPointOfContact', 'User', {
        id: user,
      })
      .optionalMatch([
        node('org'),
        relation('out', 'oldPointOfContactRel', 'pointOfContact', {
          active: true,
        }),
        node('pointOfContact', 'User'),
      ])
      .setValues({
        'oldPointOfContactRel.active': false,
      })
      .with('*')
      .create([
        node('partner'),
        relation('out', '', 'pointOfContact', {
          active: true,
          createdAt,
        }),
        node('newPointOfContact'),
      ])
      .run();
  }

  async list(
    { filter, ...input }: PartnerListInput,
    session: Session,
    limitedScope?: RoleSensitivityMapping
  ) {
    const result = await this.db
      .query()
      .match([
        ...(limitedScope
          ? [
              node('project', 'Project'),
              relation('out', '', 'partnership'),
              node('', 'Partnership'),
              relation('out', '', 'partner'),
            ]
          : []),
        node('node', 'Partner'),
        ...(filter.userId && session.userId
          ? [
              relation('out', '', 'organization', ACTIVE),
              node('', 'Organization'),
              relation('in', '', 'organization', ACTIVE),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      // match requesting user once (instead of once per row)
      .match(requestingUser(session))
      .apply((q) =>
        limitedScope
          ? q
              // group by project so this next bit doesn't run multiple times for a single project
              .with(['project', 'collect(node) as partners', 'requestingUser'])
              .apply(
                matchProjectScopedRoles({
                  session: variable('requestingUser'),
                })
              )
              .subQuery('project', (sub) =>
                sub
                  .apply(matchProjectSens())
                  .return(`${rankSens('sensitivity')} as sens`)
              )
              .raw('UNWIND partners as node')
              .matchNode('node')
              .raw(
                `WHERE any(role in scopedRoles WHERE role IN keys($sensMap) and sens <= ${rankSens(
                  'apoc.map.get($sensMap, role)'
                )})`,
                {
                  sensMap: limitedScope,
                }
              )
          : q
      )
      .apply(
        sorting(Partner, input, {
          name: (query) =>
            query
              .match([
                node('node'),
                relation('out', '', 'organization', ACTIVE),
                node('organization', 'Organization'),
                relation('out', '', 'name', ACTIVE),
                node('prop', 'Property'),
              ])
              .return<{ sortValue: string }>('prop.value as sortValue'),
        })
      )
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
