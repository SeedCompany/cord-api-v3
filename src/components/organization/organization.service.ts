import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, OnIndex } from '../../core';
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
    @Logger('org:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:OrgName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:OrgName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db
        .query()
        .raw(query)
        .run();
    }
  }

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
      await this.db.createNode({
        session,
        type: Organization.classType,
        input: { id, ...input },
        acls,
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
    return this.db.updateProperties({
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
      await this.db.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw e;
    }

    this.logger.info(`deleted organization with id`, { id });
  }

  async list(
    { page, count, sort, order, filter }: OrganizationListInput,
    session: ISession
  ): Promise<OrganizationListOutput> {
    const result = await this.db.list<Organization>({
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
      this.logger.error('Checks failed', { exception: e });
    }

    return true;
  }

  private async pullOrg(id: number): Promise<boolean> {
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

    return isGood;
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
