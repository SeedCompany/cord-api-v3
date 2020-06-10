import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException,
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
import { QueryService } from '../../core/query/query.service';
import { ForbiddenError } from 'apollo-server-core';
import { POWERS } from '../../core/query/model/powers';

@Injectable()
export class OrganizationService {
  constructor(
    @Logger('org:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly db2: QueryService
  ) {}

  @OnIndex()
  async createIndexes() {
    await this.db2.createPropertyUniquenessConstraintOnNodeAndRun(
      'OrganizationnameData',
      'value'
    );
  }

  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = prop === 'name' ? 'Property:OrgName' : 'Property';
    return [
      [
        node('newOrg'),
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
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newOrg'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newOrg'),
      ],
    ];
  };

  async create(
    input: CreateOrganization,
    session: ISession
  ): Promise<Organization> {
    if (!session.userId) {
      throw new UnauthorizedException('user id not valid');
    }

    if (
      (await this.db2.userCanCreateBaseNode(
        session.userId,
        POWERS.CREATE_ORGANIZATION
      )) === false
    ) {
      throw new UnauthorizedException(
        `user doesn't have permission to create an organization`
      );
    }

    const checkOrgName = await this.db2.confirmPropertyValueExists(
      ['OrganizationnameHolder'],
      input.name
    );

    if (checkOrgName) {
      throw new BadRequestException(
        'Organization with that name already exists.',
        'Duplicate'
      );
    }

    const id = generate();
    const createdAt = DateTime.local();

    const createOrg = await this.db2.createBaseNode(
      {
        label: 'Organization',
        id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'name',
            value: input.name,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: true,
            isOrgReadable: true,
            isPublicReadable: true,
          },
        ],
      },
      session.userId,
      true,
      session.owningOrgId
    );

    if (!createOrg) {
      throw new ServerException('failed to create organization');
    }

    return this.readOne(id, session);
  }

  async getOrgIdByName(name: string): Promise<string> {
    const id = await this.db2.getBaseNodeIdByPropertyValue(
      'OrganizationnameData',
      name
    );
    return id;
  }

  async readOne(orgId: string, session: ISession): Promise<Organization> {
    const readOrg = await this.db2.readBaseNode(
      {
        label: 'Organization',
        id: orgId,
        createdAt: '',
        props: [
          {
            key: 'name',
            value: '',
            isSingleton: true,
          },
        ],
      },
      session.userId
    );

    if (readOrg) {
      return readOrg;
    } else {
      throw new NotFoundException(`Could not find org`);
    }

    // const result = await this.db
    //   .query()
    //   .match(matchSession(session, { withAclEdit: 'canReadOrgs' }))
    //   .match([node('org', 'Organization', { active: true, id: orgId })])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', '', 'member', { active: true }),
    //     node('sg', 'SecurityGroup', { active: true }),
    //     relation('out', '', 'permission', { active: true }),
    //     node('canReadName', 'Permission', {
    //       property: 'name',
    //       active: true,
    //       read: true,
    //     }),
    //     relation('out', '', 'baseNode', { active: true }),
    //     node('org'),
    //     relation('out', '', 'name', { active: true }),
    //     node('orgName', 'Property', { active: true }),
    //   ])
    //   .return({
    //     org: [{ id: 'id', createdAt: 'createdAt' }],
    //     orgName: [{ value: 'name' }],
    //     requestingUser: [
    //       { canReadOrgs: 'canReadOrgs', canCreateOrg: 'canCreateOrg' },
    //     ],
    //     canReadName: [{ read: 'canReadName', edit: 'canEditName' }],
    //   })
    //   .first();

    // if (!result) {
    //   throw new NotFoundException('Could not find organization');
    // }

    // if (!result.canCreateOrg) {
    //   throw new ForbiddenException(
    //     'User does not have permission to create an organization'
    //   );
    // }

    // return {
    //   id: result.id,
    //   name: {
    //     value: result.name,
    //     canRead: result.canReadName,
    //     canEdit: result.canEditName,
    //   },
    //   createdAt: result.createdAt,
    // };
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
