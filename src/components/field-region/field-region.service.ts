import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
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
import { AuthorizationService } from '../authorization/authorization.service';
import { InternalAdminRole } from '../authorization/roles';
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
    session: ISession
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
      .call(createBaseNode, 'FieldRegion', secureProps)
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
    await this.authorizationService.addPermsForRole(
      InternalAdminRole,
      dbFieldRegion,
      result.id,
      session.userId as string
    );

    this.logger.debug(`field region created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<FieldRegion> {
    this.logger.debug(`Read Field Region`, {
      id: id,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

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
    };
  }

  async update(
    input: UpdateFieldRegion,
    session: ISession
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

  async delete(_id: string, _session: ISession): Promise<void> {
    // Not Implemented
  }

  async list(
    { filter, ...input }: FieldRegionListInput,
    session: ISession
  ): Promise<FieldRegionListOutput> {
    const label = 'FieldRegion';
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
