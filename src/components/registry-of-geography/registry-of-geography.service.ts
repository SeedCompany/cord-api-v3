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
  CreateRegistryOfGeography,
  RegistryOfGeography,
  RegistryOfGeographyListInput,
  RegistryOfGeographyListOutput,
  UpdateRegistryOfGeography,
} from './dto';

@Injectable()
export class RegistryOfGeographyService {
  private readonly securedProperties = {
    name: true,
    registryId: true,
  };

  constructor(
    @Logger('registryOfGeography:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:RegistryOfGeography) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:registryId]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:registryId]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:RegistryOfGeographyId) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RegistryOfGeographyId) ASSERT n.value IS UNIQUE',
    ];
  }

  protected async checkUnique(field: string, value: string, nodeName: string) {
    const checkRegistryOfGeography = await this.db
      .query()
      .match([
        node(field, nodeName, {
          value: value,
        }),
      ])
      .return([field])
      .first();

    if (checkRegistryOfGeography) {
      throw new DuplicateException(
        `registryOfGeography.${field}`,
        `RegistryOfGeography with this ${field} already exists.`
      );
    }
  }

  async create(
    input: CreateRegistryOfGeography,
    session: ISession
  ): Promise<RegistryOfGeography> {
    await this.checkUnique('name', input.name, 'FieldZoneName');
    await this.checkUnique(
      'registryId',
      input.registryId,
      'RegistryOfGeographyId'
    );

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
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, 'RegistryOfGeography', secureProps)
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('Failed to create registry of geography');
      }

      this.logger.info(`registry of geography created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error('Could not create registry of geography for user', {
        exception: err,
        userId: session.userId,
      });
      throw new ServerException('Could not create registry of geography');
    }
  }

  async readOne(id: string, session: ISession): Promise<RegistryOfGeography> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const readRegistryOfGeography = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'RegistryOfGeography', { id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<RegistryOfGeography>>>();

    const result = await readRegistryOfGeography.first();

    if (!result) {
      throw new NotFoundException('RegistryOfGeography.id', 'id');
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
    input: UpdateRegistryOfGeography,
    session: ISession
  ): Promise<RegistryOfGeography> {
    const RegistryOfGeography = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
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

    this.logger.info(`Deleted registry of geography with id`, { id });
  }

  async list(
    input: RegistryOfGeographyListInput,
    session: ISession
  ): Promise<RegistryOfGeographyListOutput> {
    const label = 'RegistryOfGeography';

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
