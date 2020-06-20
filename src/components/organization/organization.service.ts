import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  addPropertyCoalesceWithClause,
  ConfigService,
  DatabaseService,
  hasMore,
  ILogger,
  list,
  Logger,
  matchProperty,
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
    private readonly config: ConfigService,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.createdAt)',
      // 'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:OrgName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:OrgName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async create(
    input: CreateOrganization,
    session: ISession
  ): Promise<Organization> {
    const checkOrg = await this.db
      .query()
      .raw(
        `
        MATCH(org:OrgName {value: $name, active: true}) return org
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

    // create org
    const id = generate();
    const orgSgId = generate();
    const createdAt = DateTime.local().toString();
    const createOrgResult = await this.db
      .query()
      .match(
        node('publicSg', 'PublicSecurityGroup', {
          active: true,
        })
      )
      .create([
        node('orgSg', ['OrgPublicSecurityGroup', 'SecurityGroup'], {
          active: true,
          id: orgSgId,
          createdAt,
        }),
        relation('out', '', 'organization'),
        node('org', ['Organization', 'BaseNode'], {
          active: true,
          id,
          createdAt,
          owningOrgId: session.owningOrgId,
        }),
        relation('out', '', 'name', { active: true, createdAt }),
        node('name', ['Property', 'OrgName'], {
          active: true,
          createdAt,
          value: input.name,
        }),
      ])
      .with('*')
      .create([
        node('publicSg'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('perm', 'Permission', {
          active: true,
          property: 'name',
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('org'),
      ])
      .return('org')
      .first();

    if (!createOrgResult) {
      throw new ServerException('failed to create default org');
    }

    // const propLabels = {
    //   name: 'OrgName',
    // };

    // const id = await this.db.sgCreateNode({
    //   session,
    //   input: input,
    //   propLabels: propLabels,
    //   nodevar: 'organization',
    //   aclEditProp: 'canCreateOrg',
    //   sgName: input.name,
    // });
    this.logger.info(`organization created, id ${id}`);

    return this.readOne(id, session);
  }

  async readOne(orgId: string, session: ISession): Promise<Organization> {
    const requestingUserId = session.userId
      ? session.userId
      : this.config.anonUser.id;

    const props = ['name'];
    const query = this.db
      .query()
      .match([
        node('requestingUser', 'User', {
          active: true,
          id: requestingUserId,
        }),
      ])
      .match([node('org', 'Organization', { active: true, id: orgId })])
      .call(matchProperty, 'org', ...props)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        'coalesce(org.id) as id',
        'coalesce(org.createdAt) as createdAt',
      ])
      .returnDistinct([...props, 'id', 'createdAt']);

    const result = (await query.first()) as Organization | undefined;
    if (!result) {
      throw new NotFoundException('Could not find org');
    }

    return result;
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
    input: OrganizationListInput,
    session: ISession
  ): Promise<OrganizationListOutput> {
    const label = 'Organization';
    const props = ['name'];

    const listQuery = this.db.query();

    list(listQuery, session, label, props, input);

    const result = await listQuery.run();

    if (!result) {
      throw new ServerException('organizations failed');
    }

    const total = result[0].total;
    const items = result.map((r: any) => r.node);

    return {
      items,
      hasMore: hasMore(input, total),
      total,
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
