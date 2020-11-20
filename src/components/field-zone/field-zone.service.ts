import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  NotFoundException,
  ServerException,
  Session,
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
  CreateFieldZone,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZone,
} from './dto';
import { DbFieldZone } from './model';

@Injectable()
export class FieldZoneService {
  private readonly securedProperties = {
    name: true,
    director: true,
  };

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
    ];

    // create field zone
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('director', 'User', {
          id: directorId,
        }),
      ])
      .call(createBaseNode, await generateId(), 'FieldZone', secureProps)
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

  async readOne(id: string, session: Session): Promise<FieldZone> {
    this.logger.debug(`Read Field Zone`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FieldZone', { id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .return('propList, permList, node, director.id as directorId')
      .asResult<
        StandardReadResult<DbPropsOfDto<FieldZone>> & {
          directorId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find field zone', 'fieldZone.id');
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
      canDelete: true, // TODO
    };
  }

  async update(input: UpdateFieldZone, session: Session): Promise<FieldZone> {
    const fieldZone = await this.readOne(input.id, session);

    // update director
    if (input.directorId) {
      const createdAt = DateTime.local();
      const query = this.db
        .query()
        .match([
          node('user', 'User', { id: session.userId }),
          relation('in', 'memberOfSecurityGroup', 'member'),
          node('securityGroup', 'SecurityGroup'),
          relation('out', 'sgPerms', 'permission'),
          node('', 'Permission', {
            property: 'director',
            edit: true,
          }),
          relation('out', '', 'baseNode'),
          node('fieldZone', 'FieldZone', { id: input.id }),
        ])
        .with('fieldZone')
        .limit(1)
        .match([node('director', 'User', { id: input.directorId })])
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

    await this.db.sgUpdateProperties({
      session,
      object: fieldZone,
      props: ['name'],
      changes: input,
      nodevar: 'FieldZone',
    });

    return await this.readOne(input.id, session);
  }

  async delete(_id: string, _session: Session): Promise<void> {
    // Not Implemented
  }

  async list(
    { filter, ...input }: FieldZoneListInput,
    session: Session
  ): Promise<FieldZoneListOutput> {
    const label = 'FieldZone';
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
