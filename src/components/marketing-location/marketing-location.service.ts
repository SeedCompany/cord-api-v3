import { Injectable, NotFoundException } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { DuplicateException, ISession, ServerException } from '../../common';
import {
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  StandardReadResult,
} from '../../core/database/results';
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
      this.logger.error('Could not create marketing location for user', {
        exception: err,
        userId: session.userId,
      });
      throw new ServerException('Could not create marketing location');
    }
  }

  async readOne(id: string, session: ISession): Promise<MarketingLocation> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const readMarketingLocation = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'MarketingLocation', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<MarketingLocation>>>();

    const result = await readMarketingLocation.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find marketing location',
        'MarketingLocation.id'
      );
    }

    const secured = parseSecuredProperties(result.propList, result.permList, {
      name: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
    };
  }

  async update(
    input: UpdateMarketingLocation,
    session: ISession
  ): Promise<MarketingLocation> {
    const marketingLocation = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
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
    input: MarketingLocationListInput,
    session: ISession
  ): Promise<MarketingLocationListOutput> {
    const label = 'MarketingLocation';
    const secureProps = ['name'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

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
