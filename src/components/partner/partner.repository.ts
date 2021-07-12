import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  matchPropList,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
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
      .return({
        partner: [{ id: 'partnerId' }],
      })
      .asResult<{
        partnerId: ID;
      }>()
      .first();
    return result?.partnerId;
  }

  async create(input: CreatePartner, session: Session) {
    const createdAt = DateTime.local();
    const secureProps = [
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportingTypes',
        value: input.financialReportingTypes,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'pmcEntityCode',
        value: input.pmcEntityCode,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'globalInnovationsClient',
        value: input.globalInnovationsClient,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'active',
        value: input.active,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'address',
        value: input.address,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createdAt,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('organization', 'Organization', {
          id: input.organizationId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'Partner', secureProps))
      .create([
        node('node'),
        relation('out', '', 'organization', {
          active: true,
          createdAt,
        }),
        node('organization'),
      ])
      .apply((q) => {
        if (input.pointOfContactId) {
          q.with('node')
            .matchNode('pointOfContact', 'User', {
              id: input.pointOfContactId,
            })
            .create([
              node('node'),
              relation('out', '', 'pointOfContact', {
                active: true,
                createdAt,
              }),
              node('pointOfContact'),
            ]);
        }
      })
      .return('node.id as id')
      .asResult<{ id: ID }>()
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
      .apply(matchPropList)
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
      .return([
        'propList, node',
        'organization.id as organizationId',
        'pointOfContact.id as pointOfContactId',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Partner>> & {
          organizationId: ID;
          pointOfContactId: ID;
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find partner');
    }

    return result;
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
