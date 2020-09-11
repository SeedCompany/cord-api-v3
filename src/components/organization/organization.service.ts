import { Injectable } from '@nestjs/common';
import { contains, node, relation } from 'cypher-query-builder';
import { range } from 'lodash';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  addUserToSG,
  ConfigService,
  createBaseNode,
  createSG,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  OnIndex,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationService {
  private readonly securedProperties = {
    name: true,
  };

  constructor(
    @Logger('org:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
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
  }

  async create(
    input: CreateOrganization,
    session: ISession
  ): Promise<Organization> {
    const checkOrg = await this.db
      .query()
      .raw(`MATCH(org:OrgName {value: $name, active: true}) return org`, {
        name: input.name,
      })
      .first();

    if (checkOrg) {
      throw new DuplicateException(
        'organization.name',
        'Organization with this name already exists'
      );
    }

    // create org
    const secureProps: Property[] = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'OrgName',
      },
    ];
    // const baseMetaProps = [];

    const query = this.db
      .query()
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .match([
        node('publicSG', 'PublicSecurityGroup', {
          active: true,
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .call(matchRequestingUser, session)
      .call(createSG, 'orgSG', 'OrgPublicSecurityGroup')
      .call(createBaseNode, 'Organization', secureProps)
      .call(addUserToSG, 'requestingUser', 'adminSG') // must come after base node creation
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create default org');
    }

    const id = result.id;

    // add root admin to new org as an admin
    await this.db.addRootAdminToBaseNodeAsAdmin(id, 'Organization');

    this.logger.debug(`organization created`, { id });

    return await this.readOne(id, session);
  }

  async readOne(orgId: string, session: ISession): Promise<Organization> {
    this.logger.debug(`Read Organization`, {
      id: orgId,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Organization', { active: true, id: orgId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Organization>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find organization',
        'organization.id'
      );
    }

    const secured = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
    };
  }

  async update(
    input: UpdateOrganization,
    session: ISession
  ): Promise<Organization> {
    const organization = await this.readOne(input.id, session);
    return await this.db.sgUpdateProperties({
      session,
      object: organization,
      props: ['name'],
      changes: input,
      nodevar: 'organization',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }
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

    this.logger.debug(`deleted organization with id`, { id });
  }

  async list(
    { filter, ...input }: OrganizationListInput,
    session: ISession
  ): Promise<OrganizationListOutput> {
    const label = 'Organization';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.name
          ? [
              relation('out', '', 'name', { active: true }),
              node('name', 'Property', { active: true }),
            ]
          : filter.userId && session.userId
          ? [
              relation('in', '', 'organization', { active: true }),
              node('user', 'User', { active: true, id: filter.userId }),
            ]
          : []),
      ])
      .call((q) =>
        filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
      )
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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

      for (const i of range(orgCount)) {
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

  private async pullOrg(index: number): Promise<boolean> {
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
          ${index}
        LIMIT
          1
        `
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
            return await this.db.hasProperties({
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
            return await this.db.isUniqueProperties({
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
