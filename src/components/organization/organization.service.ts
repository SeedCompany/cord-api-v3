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

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    { name }: CreateOrganization,
    token: string,
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
          name.value as name
      `,
        {
          token,
          name,
          id: generate(),
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
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      createdAt: result.createdAt,
    };
  }

  async readOne(id: string, token: string): Promise<Organization> {
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
          name.value as name
        `,
        {
          id,
          token,
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
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      createdAt: result.createdAt,
    };
  }

  async update(
    input: UpdateOrganization,
    token: string,
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
          name.value as name
        `,
        {
          id: input.id,
          name: input.name,
          token,
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
        canRead: true, // TODO
        canEdit: true, // TODO
      },
      createdAt: result.createdAt,
    };
  }

  async delete(id: string, token: string): Promise<void> {
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
          token,
        },
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }
  }

  async list(
    { page, count, sort, order, name }: OrganizationListInput,
    token: string,
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
      WHERE
        org.name CONTAINS $filter
      RETURN
        org.id as id,
        org.createdAt as createdAt,
        org.name as name
      ORDER BY org.${sort} ${order}
      SKIP $skip
      LIMIT $count
      `,
        {
          filter: name, // TODO Handle no filter
          skip: (page - 1) * count,
          count,
          token,
        },
      )
      .run();

    const items = result.map<Organization>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      name: {
        value: row.name,
        canRead: true, // TODO
        canEdit: true, // TODO
      },
    }));

    return {
      items,
      hasMore: false, // TODO
      total: 0, // TODO
    };
  }
}
