import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, NotFoundException, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateOrganization, Organization, OrganizationListInput } from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository(Organization) {
  // assumes 'root' cypher variable is declared in query
  private readonly createSG =
    (cypherIdentifier: string, id: ID, label?: string) => (query: Query) => {
      const labels = ['SecurityGroup'];
      if (label) {
        labels.push(label);
      }
      const createdAt = DateTime.local();

      query.create([
        node('root'),
        relation('in', '', 'member'),
        node(cypherIdentifier, labels, { createdAt, id }),
      ]);
    };

  async checkOrg(name: string) {
    return await this.db
      .query()
      .raw(`MATCH(org:OrgName {value: $name}) return org`, {
        name: name,
      })
      .first();
  }

  async create(input: CreateOrganization, session: Session, id: string) {
    const secureProps: Property[] = [
      {
        key: 'name',
        value: input.name,
        isPublic: true,
        isOrgPublic: false,
        label: 'OrgName',
      },
      {
        key: 'address',
        value: input.address,
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
    // const baseMetaProps = [];

    const query = this.db
      .query()
      .match([
        node('publicSG', 'PublicSecurityGroup', {
          id,
        }),
      ])
      .apply(matchRequestingUser(session))
      .apply(
        this.createSG('orgSG', await generateId(), 'OrgPublicSecurityGroup')
      )
      .apply(createBaseNode(await generateId(), 'Organization', secureProps))
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
