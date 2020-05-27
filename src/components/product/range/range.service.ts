import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../../core';
import { CreateRange, Range } from './dto';

@Injectable()
export class RangeService {
  constructor(
    @Logger('range:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, range: any, baseNode: string, id: string) => {
    if (!range) {
      return [];
    }
    const createdAt = DateTime.local();
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Range:Property', {
          active: true,
          id: id,
          start: range.start,
          end: range.end,
          value: '',
        }),
      ],
    ];
  };

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

  // helper method for match properties
  propMatch = (property: string, baseNode: string) => {
    const perm = `canRead${upperFirst(property)}`;
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(
    input: CreateRange,
    type: string,
    typeId: string,
    session: ISession
  ): Promise<Range> {
    const perm = `canCreate${upperFirst(type)}`;
    const baseNode = upperFirst(type);
    const id = generate();
    try {
      await this.db
        .query()
        .match(matchSession(session, { withAclEdit: perm }))
        .match([node('node', baseNode, { active: true, id: typeId })])
        .create([
          ...this.property('range', input, 'node', id),
          ...this.permission('range', 'node'),
        ])
        .return('range.id as id')
        .first();
    } catch (err) {
      this.logger.error(`Could not create film for user ${session.userId}`);
      throw new ServerException('Could not create film');
    }
    this.logger.info(`range created, id ${id}`);
    return this.readOne(typeId, type, id, session);
  }

  async readOne(
    id: string,
    type: string,
    rangeId: string,
    session: ISession
  ): Promise<Range> {
    const perm = `canRead${upperFirst(type)}s`;
    const baseNode = upperFirst(type);
    const result = await this.db
      .query()
      .match(matchSession(session, { withAclEdit: perm }))
      .match([node('node', baseNode, { active: true, id: id })])
      .optionalMatch([...this.propMatch('name', 'node')])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadRange', 'Permission', {
          property: 'range',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
        relation('out', '', 'range', { active: true }),
        node('range', 'Property', { active: true }),
      ])
      .return({
        requestingUser: [
          { canReadFilms: 'canReadFilms', canCreateFilm: 'canCreateFilm' },
        ],
        range: [{ start: 'start', end: 'end', id: 'id' }],
        canReadRange: [{ read: 'canReadRange', edit: 'canEditRange' }],
      })
      .first();
    if (!result) {
      throw new NotFoundException('Could not find range');
    }
    if (!result.canCreateFilm) {
      throw new ForbiddenException(
        'User does not have permission to create an film'
      );
    }
    return {
      id: rangeId,
      start: result.start,
      end: result.end,
      createdAt: result.createdAt,
    };
  }
}
