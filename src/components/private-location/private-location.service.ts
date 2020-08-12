import { Injectable, NotFoundException } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  ISession,
  Sensitivity,
  ServerException,
} from '../../common';
import {
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  CreatePrivateLocation,
  PrivateLocation,
  PrivateLocationListInput,
  PrivateLocationListOutput,
  UpdatePrivateLocation,
} from './dto';

@Injectable()
export class PrivateLocationService {
  constructor(
    @Logger('privateLocation:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async create(
    input: CreatePrivateLocation,
    session: ISession
  ): Promise<PrivateLocation> {
    const checkPrivateLocation = await this.db
      .query()
      .match([node('PrivateLocation', 'LanguageName', { value: input.name })])
      .return('PrivateLocation')
      .first();

    if (checkPrivateLocation) {
      throw new DuplicateException(
        'privateLocation.name',
        'PrivateLocation with this name already exists.'
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
        label: 'LanguageName',
      },
      {
        key: 'publicName',
        value: input.publicName,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'LanguagePublicName',
      },
      {
        key: 'type',
        value: input.type,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'PrivateLocationType',
      },
      {
        key: 'sensitivity',
        value: input.sensitivity,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
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
        .call(createBaseNode, ['PrivateLocation', 'BaseNode'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a private location');
      }

      const id = result.id;

      // add root admin to new private location as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'PrivateLocation');

      this.logger.info(`private location created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create private location for user ${session.userId}`
      );
      throw new ServerException('Could not create private location');
    }
  }

  async readOne(id: string, session: ISession): Promise<PrivateLocation> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const secureProps = ['name', 'publicName', 'type', 'sensitivity'];

    const readPrivateLocation = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'PrivateLocation', id)
      .call(addAllSecureProperties, ...secureProps)
      .with([
        ...secureProps.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...secureProps, 'id', 'createdAt']);

    const result = await readPrivateLocation.first();
    if (!result) {
      throw new NotFoundException('Could not find private location');
    }

    const response: any = {
      ...result,
      sensitivity: result.sensitivity.value || Sensitivity.Low,
      type: result.type.value,
    };

    return (response as unknown) as PrivateLocation;
  }

  async update(
    input: UpdatePrivateLocation,
    session: ISession
  ): Promise<PrivateLocation> {
    const PrivateLocation = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: PrivateLocation,
      props: ['name', 'publicName'],
      changes: input,
      nodevar: 'PrivateLocation',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const PrivateLocation = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: PrivateLocation,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted private location with id`, { id });
  }

  async list(
    input: PrivateLocationListInput,
    session: ISession
  ): Promise<PrivateLocationListOutput> {
    const label = 'PrivateLocation';
    const secureProps = ['name', 'publicName'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    const result: PrivateLocationListOutput = await runListQuery(
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
