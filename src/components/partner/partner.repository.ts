import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Order, Session } from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { CreatePartner, Partner, PartnerListInput, UpdatePartner } from './dto';

@Injectable()
export class PartnerRepository extends DtoRepository(Partner) {
  private readonly orgNameSorter =
    (sortInput: string, order: Order) => (q: Query) => {
      // If the user inputs orgName as the sort value, then match the organization node for the sortValue match
      const orgProperties = ['name'];

      //The properties that are stored as strings
      const stringProperties = ['name'];
      const sortInputIsString = stringProperties.includes(sortInput);

      //if the sortInput, e.g. name, is a string type, check to see if a custom sortVal is given.  If not, coerse the default prop.value to lower case in the orderBy clause
      const sortValSecuredProp = sortInputIsString
        ? 'toLower(prop.value)'
        : 'prop.value';
      const sortValBaseNodeProp = sortInputIsString
        ? `toLower(node.${sortInput})`
        : `node.${sortInput}`;

      if (orgProperties.includes(sortInput)) {
        return q
          .match([
            node('node'),
            relation('out', '', 'organization', { active: true }),
            node('organization', 'Organization'),
          ])
          .with('*')
          .match([
            node('organization'),
            relation('out', '', sortInput, { active: true }),
            node('prop', 'Property'),
          ])
          .with('*')
          .orderBy(sortValSecuredProp, order);
      }
      return (Partner.SecuredProps as string[]).includes(sortInput)
        ? q
            .with('*')
            .match([
              node(node),
              relation('out', '', sortInput, { active: true }),
              node('prop', 'Property'),
            ])
            .with('*')
            .orderBy(sortValSecuredProp, order)
        : q.with('*').orderBy(sortValBaseNodeProp, order);
    };

  async checkPartner(organizationId: ID) {
    const partnerByOrgQ = this.db
      .query()
      .match([node('node', 'Organization', { id: organizationId })])
      .match([
        node('node'),
        relation('in', '', 'organization', { active: true }),
        node('partner', 'Partner'),
      ])
      .return({
        partner: [{ id: 'partnerId' }],
      })
      .asResult<{
        partnerId: ID;
      }>();
    return await partnerByOrgQ.first();
  }

  async create(input: CreatePartner, session: Session, createdAt: DateTime) {
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
    // create partner
    const query = this.db
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
        relation('out', '', 'organization', { active: true, createdAt }),
        node('organization'),
      ])
      .return('node.id as id');

    return await query.first();
  }

  async createProperty(
    input: CreatePartner,
    result: Dictionary<any>,
    createdAt: DateTime
  ) {
    await this.db
      .query()
      .matchNode('partner', 'Partner', {
        id: result.id,
      })
      .matchNode('pointOfContact', 'User', {
        id: input.pointOfContactId,
      })
      .create([
        node('partner'),
        relation('out', '', 'pointOfContact', {
          active: true,
          createdAt,
        }),
        node('pointOfContact'),
      ])
      .run();
  }

  async readOnePartnerByOrgId(id: ID) {
    const query = this.db
      .query()
      .match([node('node', 'Organization', { id: id })])
      .match([
        node('node'),
        relation('in', '', 'organization', { active: true }),
        node('partner', 'Partner'),
      ])
      .return({
        partner: [{ id: 'partnerId' }],
      })
      .asResult<{
        partnerId: ID;
      }>();
    return await query.first();
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

    return await query.first();
  }

  async updatePartnerProperties(input: UpdatePartner, session: Session) {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('partner', 'Partner', { id: input.id })
      .matchNode('newPointOfContact', 'User', {
        id: input.pointOfContactId,
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

  list({ filter, ...input }: PartnerListInput, session: Session) {
    const label = 'Partner';
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
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
        calculateTotalAndPaginateList(
          Partner,
          input,
          this.orgNameSorter(input.sort, input.order)
        )
      );
  }
}
