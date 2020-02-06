import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganization,
} from './dto';
import { DatabaseService } from '../../core';
import { generate } from 'shortid';
import { IRequestUser } from '../../common';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    { name }: CreateOrganization,
    token: IRequestUser,
  ): Promise<Organization> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })
          <-[:token {active: true}]-
          (user:User {
            active: true,
            canCreateOrg: true
          })
        MERGE
          (org:Organization {
            active: true
          })-[nameRel:name {active: true}]->
          (name:OrgName:Property {
            active: true,
            value: $name
          })
        ON CREATE SET
          org.id = $id,
          org.createdAt = datetime(),
          org.createdById = user.id,
          nameRel.createdAt = datetime()
        RETURN
          org.id as id,
          org.createdAt as createdAt,
          name.value as name,
          user.canCreateOrg as canCreateOrg,
          user.canReadOrgs as canReadOrgs
      `,
        {
          token: token.token,
          name,
          id: generate(),
        },
      )
      .first();

    if (!result) {
      throw new Error('Could not create organization');
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadOrgs,
        canEdit: result.canCreateOrg,
      },
      createdAt: result.createdAt,
    };
  }

  async readOne(orgId: string, token: IRequestUser): Promise<Organization> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canReadOrgs: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
          -[:name {active: true}]->
          (name:OrgName {active: true})
        RETURN
          org.id as id,
          org.createdAt as createdAt,
          name.value as name,
          user.canCreateOrg as canCreateOrg,
          user.canReadOrgs as canReadOrgs
        `,
        {
          id: orgId,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }

    if (!result.canCreateOrg) {
      throw new Error(
        'User does not have permission to create an organization',
      );
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadOrgs,
        canEdit: result.canCreateOrg,
      },
      createdAt: result.createdAt,
    };
  }

  async update(
    input: UpdateOrganization,
    token: IRequestUser,
  ): Promise<Organization> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateOrg: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
          -[:name {active: true}]->
          (name:OrgName {active: true})
        SET
          name.value = $name
        RETURN
          org.id as id,
          org.createdAt as createdAt,
          name.value as name,
          user.canCreateOrg as canCreateOrg,
          user.canReadOrgs as canReadOrgs
        `,
        {
          id: input.id,
          name: input.name,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadOrgs,
        canEdit: result.canCreateOrg,
      },
      createdAt: result.createdAt,
    };
  }

  async delete(id: string, token: IRequestUser): Promise<void> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateOrg: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
        SET
          org.active = false
        RETURN
          org.id as id
        `,
        {
          id,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }
  }

  async list(
    { page, count, sort, order, filter }: OrganizationListInput,
    token: IRequestUser,
  ): Promise<OrganizationListOutput> {
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (user:User {
          canReadOrgs: true
        }),
        (org:Organization {
          active: true
        })
//      WHERE
//        org.name CONTAINS $filter
      WITH count(org) as orgs, user
      MATCH
        (org:Organization {
          active: true
        })
        -[:name {active: true}]->
        (name:OrgName {
          active: true
        })
      RETURN
        org.id as id,
        org.createdAt as createdAt,
        name.value as name,
        user.canCreateOrg as canCreateOrg,
        user.canReadOrgs as canReadOrgs,
        orgs as total
      ORDER BY org.${sort} ${order}
      SKIP $skip
      LIMIT $count
      `,
        {
          // filter: filter.name, // TODO Handle no filter
          skip: (page - 1) * count,
          count,
          token: token.token,
        },
      )
      .run();

    const items = result.map<Organization>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      name: {
        value: row.name,
        canRead: row.canReadOrgs,
        canEdit: row.canCreateOrg,
      },
    }));

    const hasMore = (((page - 1) * count) + count < result[0].total); // if skip + count is less than total there is more

    return {
      items,
      hasMore,
      total: result[0].total,
    };
  }
}
