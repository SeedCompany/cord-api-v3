import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
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
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateFieldZone,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZone,
} from './dto';
import { DbFieldZone } from './model';

@Injectable()
export class FieldZoneService {
  constructor(
    @Logger('field-zone:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      // FIELD ZONE NODE
      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.createdAt)',

      // FIELD ZONE NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // FIELD ZONE NAME NODE
      'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    { directorId, ...input }: CreateFieldZone,
    session: Session
  ): Promise<FieldZone> {
    const checkName = await this.db
      .query()
      .match([node('name', 'FieldZoneName', { value: input.name })])
      .return('name')
      .first();

    if (checkName) {
      throw new DuplicateException(
        'fieldZone.name',
        'FieldZone with this name already exists.'
      );
    }

    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'FieldZoneName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create field zone
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('director', 'User', {
          id: directorId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'FieldZone', secureProps))
      .create([
        node('node'),
        relation('out', '', 'director', { active: true, createdAt }),
        node('director'),
      ])
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create field zone');
    }

    const dbFieldZone = new DbFieldZone();
    await this.authorizationService.processNewBaseNode(
      dbFieldZone,
      result.id,
      session.userId
    );

    this.logger.debug(`field zone created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<FieldZone> {
    this.logger.debug(`Read Field Zone`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FieldZone', { id: id })])
      .apply(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .return('propList, node, director.id as directorId')
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldZone>> & {
          directorId: ID;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find field zone', 'fieldZone.id');
    }

    const secured = await this.authorizationService.secureProperties(
      FieldZone,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      director: {
        ...secured.director,
        value: result.directorId,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateFieldZone, session: Session): Promise<FieldZone> {
    const fieldZone = await this.readOne(input.id, session);

    const changes = this.db.getActualChanges(FieldZone, fieldZone, input);
    await this.authorizationService.verifyCanEditChanges(
      FieldZone,
      fieldZone,
      changes
    );

    const { directorId, ...simpleChanges } = changes;

    // update director
    if (directorId) {
      const createdAt = DateTime.local();
      const query = this.db
        .query()
        .match(node('fieldZone', 'FieldZone', { id: input.id }))
        .with('fieldZone')
        .limit(1)
        .match([node('director', 'User', { id: directorId })])
        .optionalMatch([
          node('fieldZone'),
          relation('out', 'oldRel', 'director', { active: true }),
          node(''),
        ])
        .setValues({ 'oldRel.active': false })
        .with('fieldZone, director')
        .limit(1)
        .create([
          node('fieldZone'),
          relation('out', '', 'director', {
            active: true,
            createdAt,
          }),
          node('director'),
        ]);

      await query.run();
    }

    await this.db.updateProperties({
      type: FieldZone,
      object: fieldZone,
      changes: simpleChanges,
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Field Zone');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Field Zone'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: FieldZoneListInput,
    session: Session
  ): Promise<FieldZoneListOutput> {
    const label = 'FieldZone';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(FieldZone, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
