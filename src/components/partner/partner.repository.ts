import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
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
  matchProjectSensToLimitedScopeMap,
  matchProps,
  merge,
  paginate,
  rankSens,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { CreatePartner, Partner, PartnerListInput } from './dto';
import { partnerListFilter } from './query.helpers';

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

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'Partner')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate(session))
      .map('dto')
      .run();
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
        .raw('', { requestingUserId: session.userId })
        .return<{ dto: UnsecuredDto<Partner> }>(
          merge('props', {
            sensitivity: 'sensitivity',
            organization: 'organization.id',
            pointOfContact: 'pointOfContact.id',
            scope: 'scopedRoles',
            pinned:
              'exists((:User { id: $requestingUserId })-[:pinned]->(node))',
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
    limitedScope?: AuthSensitivityMapping
  ) {
    const result = await this.db
      .query()
      .matchNode('node', 'Partner')
      .match([
        ...(filter.userId && session.userId
          ? [
              node('node'),
              relation('out', '', 'organization', ACTIVE),
              node('', 'Organization'),
              relation('in', '', 'organization', ACTIVE),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .apply((q) =>
        limitedScope
          ? q.optionalMatch([
              node('project', 'Project'),
              relation('out', '', 'partnership'),
              node('', 'Partnership'),
              relation('out', '', 'partner'),
              node('node'),
            ])
          : q
      )
      // match requesting user once (instead of once per row)
      .match(requestingUser(session))
      .apply(partnerListFilter(filter))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
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
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
