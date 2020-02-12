import { Injectable, NotFoundException } from '@nestjs/common';
import { ISession } from '../auth';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganization,
} from './dto';
import { DatabaseService, ILogger, Logger } from '../../core';
import { generate } from 'shortid';
import { DateTime } from 'luxon';


@Injectable()
export class OrganizationService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('auth:service') private readonly logger: ILogger,
    ) {}

  async create(
    { name }: CreateOrganization,
    { token }: ISession,
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
          token,
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

  async readOne(orgId: string, { token }: ISession): Promise<Organization> {
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
          token,
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
    { token }: ISession,
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
        canRead: result.canReadOrgs,
        canEdit: result.canCreateOrg,
      },
      createdAt: result.createdAt,
    };
  }

  async delete(id: string, { token }: ISession): Promise<void> {
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
    { page, count, sort, order, filter }: OrganizationListInput,
    { token }: ISession,
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
          token,
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

    const hasMore = (page - 1) * count + count < result[0].total; // if skip + count is less than total there is more

    return {
      items,
      hasMore,
      total: result[0].total,
    };
  }

  async checkAllOrgs(session?: ISession): Promise<boolean> {
    try {
      const result = await this.db
        .query()
        .raw(
          `
          MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            isAdmin: true
          }),
            (org:Organization {
              active: true
            })
          RETURN
            count(org) as orgCount
          `,
          {
            token: session.token,
          },
        )
        .first();

      const orgCount = result.orgCount;

      for (let i = 0; i < orgCount; i++) {
        const isGood = await this.pullOrg(i);
        if (!isGood) {
          return false;
        }
      }
    } catch (e) {
      console.error(e);
    }

    return true;
  }

  private async pullOrg(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .query()
        .raw(
          `
        MATCH
          (org:Organization {
            active: true
          })
          -[:name {active: true}]->
          (name:OrgName {active: true})
        RETURN
          org.id as id,
          org.createdAt as createdAt,
          name.value as name
        ORDER BY
          createdAt
        SKIP
          ${id}
        LIMIT
          1
        `,
          {
            id,
          },
        )
        .first();

      const isGood = this.validateOrg({
        id: result.id,
        createdAt: result.createdAt,
        name: {
          value: result.name,
          canRead: null,
          canEdit: null,
        },
      });

      if (!isGood) {
        return false;
      }
    } catch (e) {
      console.error(e);
    }

    return true;
  }

  private validateOrg(org: Organization): boolean {
    // org has an id
    if (org.id === undefined || org.id === null) {
      this.logger.error('bad org id', org);
      return false;
    }
    // org has a name
    if (org.name.value === undefined || org.name.value === null) {
      this.logger.error('org has a bad name', org);
      return false;
    }
    // created after 1990
    if (org.createdAt.year <= 1990) {
      this.logger.error('org has a bad createdAt: ', org);
      return false;
    }

    return true;
  }
}
