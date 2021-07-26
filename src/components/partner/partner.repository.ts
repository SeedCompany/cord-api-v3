import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
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
  createNode,
  createRelationships,
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreatePartner, Partner, PartnerListInput } from './dto';

@Injectable()
export class PartnerRepository extends DtoRepository(Partner) {
  async partnerIdByOrg(organizationId: ID) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Organization', { id: organizationId }),
        relation('in', '', 'organization', { active: true }),
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
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find partner');
    }

    return result.dto;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'organization', { active: true }),
          node('organization', 'Organization'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'pointOfContact', { active: true }),
          node('pointOfContact', 'User'),
        ])
        .return<{ dto: UnsecuredDto<Partner> }>(
          merge('props', {
            organization: 'organization.id',
            pointOfContact: 'pointOfContact.id',
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

  async list({ filter, ...input }: PartnerListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Partner'),
        ...(filter.userId && session.userId
          ? [
              relation('out', '', 'organization', { active: true }),
              node('', 'Organization'),
              relation('in', '', 'organization', { active: true }),
              node('user', 'User', { id: filter.userId }),
            ]
          : []),
      ])
      .apply(
        sorting(Partner, input, {
          name: (query) =>
            query
              .match([
                node('node'),
                relation('out', '', 'organization', { active: true }),
                node('organization', 'Organization'),
                relation('out', '', 'name', { active: true }),
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
