import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import {
  DatabaseService,
  ILogger,
  Logger,
  PropertyUpdaterService,
} from '../../core';
import { ISession } from '../auth';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('org:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService
  ) {}

  async create(
    input: CreateOrganization,
    session: ISession
  ): Promise<Organization> {
    const id = generate();
    const acls = {
      canReadOrg: true,
      canEditOrg: true,
      canEditName: true,
      canReadName: true,
    };
    try {
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Organization',
        aclEditProp: 'canCreateOrg',
      });
    } catch {
      this.logger.error(
        `Could not create organization for user ${session.userId}`
      );
      throw new Error('Could not create unavailability');
    }

    this.logger.info(`organization created, id ${id}`);

    return await this.readOne(id, session);
  }

  async readOne(orgId: string, session: ISession): Promise<Organization> {
    const query = `
    MATCH
      (token:Token {active: true, value: $token})
      <-[:token {active: true}]-
      (user:User {
        canReadOrgs: true
      }),
      (org:Organization {
        active: true,
        id: $id,
        owningOrgId: $owningOrgId
      })
      -[:name {active: true}]->
      (name:Property {active: true})
    RETURN
      org.id as id,
      org.createdAt as createdAt,
      name.value as name,
      user.canCreateOrg as canCreateOrg,
      user.canReadOrgs as canReadOrgs
    `;
    const result = await this.db
      .query()
      .raw(query, {
        id: orgId,
        token: session.token,
        owningOrgId: session.owningOrgId,
      })
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }

    if (!result.canCreateOrg) {
      throw new Error(
        'User does not have permission to create an organization'
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
    session: ISession
  ): Promise<Organization> {
    const organization = await this.readOne(input.id, session);
    return this.propertyUpdater.updateProperties({
      session,
      object: organization,
      props: ['name'],
      changes: input,
      nodevar: 'organization',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const ed = await this.readOne(id, session);
    try {
      await this.propertyUpdater.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async list(
    { page, count, sort, order, filter }: OrganizationListInput,
    session: ISession
  ): Promise<OrganizationListOutput> {
    const result = await this.propertyUpdater.list<Organization>({
      session,
      nodevar: 'organization',
      aclReadProp: 'canReadOrgs',
      aclEditProp: 'canCreateOrg',
      props: ['name'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async checkAllOrgs(session: ISession): Promise<boolean> {
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
          }
        )
        .first();

      const orgCount = result?.orgCount;

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
          (name:Property {active: true})
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
          }
        )
        .first();

      const isGood = this.validateOrg({
        id: result?.id,
        createdAt: result?.createdAt,
        name: {
          value: result?.name,
          canRead: false,
          canEdit: false,
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
