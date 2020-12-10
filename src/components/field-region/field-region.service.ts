import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
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
  UniqueProperties,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
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
  private readonly securedProperties = {
    name: true,
    director: true,
    fieldZone: true,
  };

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

  async readOne(id: string, session: Session): Promise<FieldRegion> {
    this.logger.debug(`Read Field Region`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FieldRegion', { id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
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
        'propList, permList, node, director.id as directorId, fieldZone.id as fieldZoneId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldRegion>> & {
          directorId: string;
          fieldZoneId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find field region',
        'fieldRegion.id'
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

    // update director

    await this.db.sgUpdateProperties({
      session,
      object: fieldRegion,
      props: ['name'],
      changes: input,
      nodevar: 'fieldRegion',
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Field Region');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Field Region'
      );

    const baseNodeLabels = ['BaseNode', 'FieldRegion'];

    const uniqueProperties: UniqueProperties<FieldRegion> = {
      name: ['Property', 'FieldRegionName'],
    };

    try {
      await this.db.deleteNodeNew<FieldRegion>({
        object,
        baseNodeLabels,
        uniqueProperties,
      });
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
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
