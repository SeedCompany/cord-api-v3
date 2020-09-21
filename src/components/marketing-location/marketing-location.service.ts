import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPermList,
  matchPropList,
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
  CreateMarketingLocation,
  MarketingLocation,
  MarketingLocationListInput,
  MarketingLocationListOutput,
  UpdateMarketingLocation,
} from './dto';

@Injectable()
export class MarketingLocationService {
  private readonly securedProperties = {
    name: true,
  };

  constructor(
    @Logger('marketing-location:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:MarketingLocation) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
    ];
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
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, 'MarketingLocation', secureProps)
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('Failed to create marketing location');
      }

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
      .match([node('node', 'MarketingLocation', { id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<MarketingLocation>>>();

    const result = await readMarketingLocation.first();

    if (!result) {
      throw new NotFoundException('MarketingLocation.id', 'id');
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

  async delete(_id: string, _session: ISession): Promise<void> {
    // Not implemented
  }

  async list(
    input: MarketingLocationListInput,
    session: ISession
  ): Promise<MarketingLocationListOutput> {
    const label = 'MarketingLocation';

    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property'),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
