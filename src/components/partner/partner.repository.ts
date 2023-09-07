import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, ServerException, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  collect,
  createNode,
  createRelationships,
  filter as filters,
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
import { CreatePartner, Partner, PartnerListInput } from './dto';

@Injectable()
export class PartnerRepository extends DtoRepository<
  typeof Partner,
  [session: Session]
>(Partner) {
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
          languageOfWiderCommunication: [
            'Language',
            input.languageOfWiderCommunicationId,
          ],
          fieldRegions: ['FieldRegion', input.fieldRegions],
          countries: ['Location', input.countries],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create partner');
    }
    return result.id;
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
            .return(`'High' as sensitivity`),
        )
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'fieldRegions'),
              node('fieldRegions', 'FieldRegion'),
            ])
            .return(collect('fieldRegions.id').as('fieldRegionsIds')),
        )
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'countries'),
              node('countries', 'Location'),
            ])
            .return(collect('countries.id').as('countriesIds')),
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
        .optionalMatch([
          node('node'),
          relation('out', '', 'languageOfWiderCommunication', ACTIVE),
          node('languageOfWiderCommunication', 'Language'),
        ])
        .return<{ dto: UnsecuredDto<Partner> }>(
          merge('props', {
            sensitivity: 'sensitivity',
            organization: 'organization.id',
            pointOfContact: 'pointOfContact.id',
            languageOfWiderCommunication: 'languageOfWiderCommunication.id',
            fieldRegions: 'fieldRegionsIds',
            countries: 'countriesIds',
            scope: 'scopedRoles',
            pinned: 'exists((:User { id: $requestingUser })-[:pinned]->(node))',
          }).as('dto'),
        );
  }

  async list({ filter, ...input }: PartnerListInput, session: Session) {
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
      .match(requestingUser(session))
      .apply(
        filters.builder(filter, {
          pinned: filters.isPinned,
          userId: filters.skip, // already applied above
        }),
      )
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: (inner) => (query) =>
            query
              .optionalMatch([
                node('project', 'Project'),
                relation('out', '', 'partnership'),
                node('', 'Partnership'),
                relation('out', '', 'partner'),
                node('node'),
              ])
              .apply(oncePerProject(inner)),
        }),
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
        }),
      )
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
