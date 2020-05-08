import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
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
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = prop === 'name' ? 'Property:OrgName' : 'Property';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (
    property: string,
    sg: string,
    baseNode: string,
    read: boolean,
    edit: boolean
  ) => {
    const createdAt = DateTime.local();
    return [
      [
        node(sg),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read,
          edit,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  async create(
    input: CreateOrganization,
    session: ISession
  ): Promise<Organization> {
    const checkOrg = await this.db
      .query()
      .raw(
        `
        MATCH(org:OrgName {value: $name}) return org
        `,
        {
          name: input.name,
        }
      )
      .first();

    if (checkOrg) {
      throw new BadRequestException(
        'Organization with that name already exists.',
        'Duplicate'
      );
    }
    const id = generate();
    const createdAt = DateTime.local();
    try {
      await this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateOrg' }))
        .create([
          [
            node('newOrg', 'Organization:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newOrg'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('name', 'adminSG', 'newOrg', true, true),
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('name', 'readerSG', 'newOrg', true, false),
        ])
        .return('newOrg.id as id')
        .first();

      // if (!result) {
      //   throw new ServerException('failed to create organization');
      // }
    } catch (err) {
      this.logger.error(
        `Could not create organization for user ${session.userId}`
      );
      throw new ServerException('Could not create organization');
    }

    this.logger.info(`organization created, id ${id}`);

    return this.readOne(id, session);
  }

  async readOne(orgId: string, session: ISession): Promise<Organization> {
    const result = await this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadOrgs' }))
      .match([node('org', 'Organization', { active: true, id: orgId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('org'),
      ])
      .optionalMatch([
        node('org'),
        relation('out', '', 'name', { active: true }),
        node('orgName', 'Property', { active: true }),
      ])
      .return({
        org: [{ id: 'id', createdAt: 'createdAt' }],
        orgName: [{ value: 'name' }],
        requestingUser: [
          { canReadOrgs: 'canReadOrgs', canCreateOrg: 'canCreateOrg' },
        ],
        canReadName: [{ read: 'canReadName', edit: 'canEditName' }],
      })
      .first();

    if (!result) {
      throw new NotFoundException('Could not find organization');
    }

    if (!result.canCreateOrg) {
      throw new ForbiddenException(
        'User does not have permission to create an organization'
      );
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: result.canReadName,
        canEdit: result.canEditName,
      },
      createdAt: result.createdAt,
    };
  }

  async update(
    input: UpdateOrganization,
    session: ISession
  ): Promise<Organization> {
    const organization = await this.readOne(input.id, session);
    return this.db.sgUpdateProperties({
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
      throw new ServerException('Failed to delete');
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

  async checkOrganizationConsistency(session: ISession): Promise<boolean> {
    const organizations = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('organization', 'Organization', {
            active: true,
          }),
        ],
      ])
      .return('organization.id as id')
      .run();

    return (
      (
        await Promise.all(
          organizations.map(async (organization) => {
            return this.db.hasProperties({
              session,
              id: organization.id,
              props: ['name'],
              nodevar: 'organization',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          organizations.map(async (organization) => {
            return this.db.isUniqueProperties({
              session,
              id: organization.id,
              props: ['name'],
              nodevar: 'organization',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
