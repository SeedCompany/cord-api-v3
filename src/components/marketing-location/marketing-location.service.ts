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
  CreateMarketingLocation,
  MarketingLocation,
  MarketingLocationListInput,
  MarketingLocationListOutput,
  UpdateMarketingLocation,
} from './dto';

@Injectable()
export class MarketingLocationService {
  constructor(
    @Logger('marketingLocation:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
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
    input: CreateMarketingLocation,
    session: ISession
  ): Promise<MarketingLocation> {
    const checkMarketingLocation = await this.db
      .query()
      .match([
        node('marketingLocation', 'FieldZoneName', {
          value: input.name,
        }),
      ])
      .return('marketingLocation')
      .first();

    if (checkMarketingLocation) {
      throw new DuplicateException(
        'marketingLocation.name',
        'MarketingLocation with this name already exists.'
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
        label: 'FieldZoneName',
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
        .call(createBaseNode, ['MarketingLocation', 'BaseNode'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a marketing location');
      }

      const id = result.id;

      // add root admin to new marketing location as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'MarketingLocation');

      this.logger.info(`marketing location created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create marketing location for user ${session.userId}`
      );
      throw new ServerException('Could not create marketing location');
    }
  }

  async readOne(id: string, session: ISession): Promise<MarketingLocation> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const secureProps = ['name'];

    const readMarketingLocation = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'MarketingLocation', id)
      .call(addAllSecureProperties, ...secureProps)
      .with([
        ...secureProps.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...secureProps, 'id', 'createdAt']);

    const result = (await readMarketingLocation.first()) as
      | MarketingLocation
      | undefined;
    if (!result) {
      throw new NotFoundException('Could not find marketing location');
    }

    return result;
  }

  async update(
    input: UpdateMarketingLocation,
    session: ISession
  ): Promise<MarketingLocation> {
    const marketingLocation = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: marketingLocation,
      props: ['name'],
      changes: input,
      nodevar: 'marketingLocation',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const marketingLocation = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: marketingLocation,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted marketing location with id`, { id });
  }

  async list(
    { filter, ...input }: MarketingLocationListInput,
    session: ISession
  ): Promise<MarketingLocationListOutput> {
    const label = 'MarketingLocation';
    const secureProps = ['name'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }

    const result: MarketingLocationListOutput = await runListQuery(
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
