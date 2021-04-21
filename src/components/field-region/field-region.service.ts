import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  FieldRegionListOutput,
  UpdateFieldRegion,
} from './dto';
import { DbFieldRegion } from './model';

@Injectable()
export class FieldRegionService {
  constructor(
    @Logger('field-region:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      // FIELD REGION NODE
      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.createdAt)',

      // FIELD REGION NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // FIELD REGION NAME NODE
      'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    { fieldZoneId, directorId, ...input }: CreateFieldRegion,
    session: Session
  ): Promise<FieldRegion> {
    const checkName = await this.db
      .query()
      .match([node('name', 'FieldRegionName', { value: input.name })])
      .return('name')
      .first();

    if (checkName) {
      throw new DuplicateException(
        'fieldRegion.name',
        'FieldRegion with this name already exists.'
      );
    }

    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'FieldRegionName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create field region
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('director', 'User', {
          id: directorId,
        }),
      ])
      .match([
        node('fieldZone', 'FieldZone', {
          id: fieldZoneId,
        }),
      ])
      .call(createBaseNode, await generateId(), 'FieldRegion', secureProps)
      .create([
        node('node'),
        relation('out', '', 'director', { active: true, createdAt }),
        node('director'),
      ])
      .create([
        node('node'),
        relation('out', '', 'zone', { active: true, createdAt }),
        node('fieldZone'),
      ])
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create field region');
    }

    const dbFieldRegion = new DbFieldRegion();
    await this.authorizationService.processNewBaseNode(
      dbFieldRegion,
      result.id,
      session.userId
    );

    this.logger.debug(`field region created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<FieldRegion> {
    this.logger.debug(`Read Field Region`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FieldRegion', { id: id })])
      .apply(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'zone', { active: true }),
        node('fieldZone', 'FieldZone'),
      ])
      .return(
        'propList, node, director.id as directorId, fieldZone.id as fieldZoneId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldRegion>> & {
          directorId: ID;
          fieldZoneId: ID;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find field region',
        'fieldRegion.id'
      );
    }

    const secured = await this.authorizationService.secureProperties(
      FieldRegion,
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
      fieldZone: {
        ...secured.fieldZone,
        value: result.fieldZoneId,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    input: UpdateFieldRegion,
    session: Session
  ): Promise<FieldRegion> {
    const fieldRegion = await this.readOne(input.id, session);
    const changes = this.db.getActualChanges(FieldRegion, fieldRegion, input);
    await this.authorizationService.verifyCanEditChanges(
      FieldRegion,
      fieldRegion,
      changes
    );
    // update director

    await this.db.updateProperties({
      type: FieldRegion,
      object: fieldRegion,
      changes: changes,
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Field Region');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Field Region'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: FieldRegionListInput,
    session: Session
  ): Promise<FieldRegionListOutput> {
    const label = 'FieldRegion';
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(FieldRegion, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
