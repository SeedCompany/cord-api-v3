import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { ISession } from '../../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../../core';
import { Range, UpdateRange } from './dto/range';

@Injectable()
export class RangeService {
  constructor(
    @Logger('range:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:RangeStart) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RangeEnd) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON ()-[r:rangeStart]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:rangeStart]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:rangeEnd]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:rangeEnd]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

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

  async readOne(filmId: string, session: ISession): Promise<Range> {
    const result = await this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadFilms' }))
      .match([node('film', 'Film', { active: true, id: filmId })])
      .optionalMatch([...this.propMatch('name', 'film')])
      .optionalMatch([...this.propMatch('range', 'film')])
      .optionalMatch([...this.propMatch('rangeStart', 'range')])
      .optionalMatch([...this.propMatch('rangeEnd', 'range')])
      .return({
        film: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        range: [{ value: 'range' }],
        requestingUser: [
          { canReadFilms: 'canReadFilms', canCreateFilm: 'canCreateFilm' },
        ],
        canReadName: [{ read: 'canReadName', edit: 'canEditName' }],
        rangeStart: [{ value: 'rangeStart' }],
        canReadRangeStart: [
          { read: 'canReadRangeStart', edit: 'canEditRangeStart' },
        ],
        rangeEnd: [{ value: 'rangeEnd' }],
        canReadRangeEnd: [{ read: 'canReadRangeEnd', edit: 'canEditRangeEnd' }],
      })
      .first();

    if (!result) {
      throw new NotFoundException('Could not find film');
    }
    if (!result.canCreateFilm) {
      throw new ForbiddenException(
        'User does not have permission to create an film'
      );
    }

    return {
      id: result.range,
      rangeStart: {
        value: result.rangeStart,
        canRead: !!result.canReadRangeStart,
        canEdit: !!result.canEditRangeStart,
      },
      rangeEnd: {
        value: result.rangeEnd,
        canRead: !!result.canReadRangeEnd,
        canEdit: !!result.canEditRangeEnd,
      },
      createdAt: result.createdAt,
    };
  }

  async update(
    input: UpdateRange,
    session: ISession,
    id: string
  ): Promise<Range> {
    const range = await this.readOne(id, session);
    return this.db.sgUpdateProperties({
      session,
      object: range,
      props: ['rangeStart', 'rangeEnd'],
      changes: input,
      nodevar: 'range',
    });
  }
}
