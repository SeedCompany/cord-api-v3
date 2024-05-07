import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  ID,
  InputException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
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
  merge,
  oncePerProject,
  paginate,
  rankSens,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreatePartner, Partner, PartnerListInput, UpdatePartner } from './dto';

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
    return result?.id ?? null;
  }

  async create(input: CreatePartner, session: Session) {
    const partnerExists = await this.partnerIdByOrg(input.organizationId);
    if (partnerExists) {
      throw new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.',
      );
    }

    const initialProps = {
      types: input.types,
      financialReportingTypes: input.financialReportingTypes,
      pmcEntityCode: input.pmcEntityCode,
      globalInnovationsClient: input.globalInnovationsClient,
      active: input.active,
      startDate: input.startDate ?? CalendarDate.local(),
      address: input.address,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };
    const result = await this.db
      .query()
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
          languagesOfConsulting: ['Language', input.languagesOfConsulting],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create partner');
    }

    return await this.readOne(result.id, session);
  }

  async update(changes: UpdatePartner, session: Session) {
    const {
      id,
      pointOfContactId,
      languageOfWiderCommunicationId,
      fieldRegions,
      countries,
      languagesOfConsulting,
      ...simpleChanges
    } = changes;

    await this.updateProperties({ id }, simpleChanges);

    if (pointOfContactId !== undefined) {
      await this.updateRelation(
        'pointOfContact',
        'User',
        changes.id,
        pointOfContactId,
      );
    }

    if (languageOfWiderCommunicationId) {
      await this.updateRelation(
        'languageOfWiderCommunication',
        'Language',
        changes.id,
        languageOfWiderCommunicationId,
      );
    }

    if (countries) {
      try {
        await this.updateRelationList({
          id: changes.id,
          relation: 'countries',
          newList: countries,
        });
      } catch (e) {
        throw e instanceof InputException
          ? e.withField('partner.countries')
          : e;
      }
    }

    if (fieldRegions) {
      try {
        await this.updateRelationList({
          id: changes.id,
          relation: 'fieldRegions',
          newList: fieldRegions,
        });
      } catch (e) {
        throw e instanceof InputException
          ? e.withField('partner.fieldRegions')
          : e;
      }
    }

    if (languagesOfConsulting) {
      try {
        await this.updateRelationList({
          id: changes.id,
          relation: 'languagesOfConsulting',
          newList: languagesOfConsulting,
        });
      } catch (e) {
        throw e instanceof InputException
          ? e.withField('partner.languagesOfConsulting')
          : e;
      }
    }

    return await this.readOne(id, session);
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
            .return(collect('fieldRegions { .id }').as('fieldRegions')),
        )
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'countries'),
              node('countries', 'Location'),
            ])
            .return(collect('countries { .id }').as('countries')),
        )
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'languagesOfConsulting', ACTIVE),
              node('languagesOfConsulting', 'Language'),
            ])
            .return(
              collect('languagesOfConsulting { .id }').as(
                'languagesOfConsulting',
              ),
            ),
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
            organization: 'organization { .id }',
            pointOfContact: 'pointOfContact { .id }',
            languageOfWiderCommunication:
              'languageOfWiderCommunication { .id }',
            fieldRegions: 'fieldRegions',
            countries: 'countries',
            languagesOfConsulting: 'languagesOfConsulting',
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
