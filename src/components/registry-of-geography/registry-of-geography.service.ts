import { Injectable, NotFoundException } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DuplicateException, ISession, ServerException } from '../../common';
import {
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  CreateRegistryOfGeography,
  RegistryOfGeography,
  RegistryOfGeographyListInput,
  RegistryOfGeographyListOutput,
  UpdateRegistryOfGeography,
} from './dto';

@Injectable()
export class RegistryOfGeographyService {
  constructor(
    @Logger('registryOfGeography:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:registryId]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:registryId]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:RegistryOfGeographyName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeographyName) ASSERT n.value IS UNIQUE',

      'CREATE CONSTRAINT ON (n:RegistryOfGeographyId) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeographyId) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
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
        node(baseNode),
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
        node(baseNode),
      ],
    ];
  };

  async create(
    input: CreateRegistryOfGeography,
    session: ISession
  ): Promise<RegistryOfGeography> {
    const checkRegistryOfGeography = await this.db
      .query()
      .match([
        node('RegistryOfGeography', 'RegistryOfGeographyName', {
          value: input.name,
        }),
      ])
      .return('RegistryOfGeography')
      .first();

    if (checkRegistryOfGeography) {
      throw new DuplicateException(
        'registryOfGeography.name',
        'RegistryOfGeography with this name already exists.'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'RegistryOfGeographyName',
      },
      {
        key: 'registryId',
        value: input.registryId,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'RegistryOfGeographyId',
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('rootUser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(
          createBaseNode,
          ['RegistryOfGeography', 'BaseNode'],
          secureProps,
          {
            owningOrgId: session.owningOrgId,
          }
        )
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a registry of geography');
      }

      const id = result.id;

      // add root admin to new registry of geography as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'RegistryOfGeography');

      this.logger.info(`registry of geography created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create registry of geography for user ${session.userId}`
      );
      throw new ServerException('Could not create registry of geography');
    }
  }

  async readOne(id: string, session: ISession): Promise<RegistryOfGeography> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const secureProps = ['name', 'registryId'];

    const readRegistryOfGeography = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'RegistryOfGeography', id)
      .call(addAllSecureProperties, ...secureProps)
      .with([
        ...secureProps.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...secureProps, 'id', 'createdAt']);

    const result = (await readRegistryOfGeography.first()) as
      | RegistryOfGeography
      | undefined;
    if (!result) {
      throw new NotFoundException('Could not find registry of geography');
    }

    return result;
  }

  async update(
    input: UpdateRegistryOfGeography,
    session: ISession
  ): Promise<RegistryOfGeography> {
    const RegistryOfGeography = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: RegistryOfGeography,
      props: ['name', 'registryId'],
      changes: input,
      nodevar: 'registryOfGeography',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const RegistryOfGeography = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: RegistryOfGeography,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted registry of geography with id`, { id });
  }

  async list(
    { filter, ...input }: RegistryOfGeographyListInput,
    session: ISession
  ): Promise<RegistryOfGeographyListOutput> {
    const label = 'RegistryOfGeography';
    const secureProps = ['name', 'registryId'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }

    const result: RegistryOfGeographyListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      result.items.map((row: any) => this.readOne(row.properties.id, session))
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
