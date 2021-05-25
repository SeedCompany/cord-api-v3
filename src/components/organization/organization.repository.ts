import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly db: DatabaseService) {}
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
      .return('node.id as id');

    return await query.first();
  }

  async readOne(orgId: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Organization', { id: orgId })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Organization>>>();
    return await query.first();
  }

  async checkDeletePermission(orgId: ID, session: Session) {
    return await this.db.checkDeletePermission(orgId, session);
  }

  getActualChanges(organization: Organization, input: UpdateOrganization) {
    return this.db.getActualChanges(Organization, organization, input);
  }

  async updateProperties(
    object: Organization,
    changes: DbChanges<Organization>
  ) {
    return await this.db.updateProperties({
      type: Organization,
      object,
      changes,
    });
  }

  async deleteNode(node: Organization) {
    await this.db.deleteNode(node);
  }

  list({ filter, ...input }: OrganizationListInput, session: Session) {
    return this.db
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
      .apply(calculateTotalAndPaginateList(Organization, input));
  }
}
