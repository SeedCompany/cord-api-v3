import {
  BadRequestException,
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
import {
  CreateFilm,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilm,
} from './dto';

@Injectable()
export class FilmService {
  constructor(
    @Logger('film:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON (n:RangeStart) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:RangeEnd) ASSERT EXISTS(n.value)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:rangeStart]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:rangeStart]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:rangeEnd]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:rangeEnd]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:FilmName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FilmName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel =
      prop === 'name'
        ? 'Property:FilmName'
        : prop === 'rangeStart'
        ? 'Property:RangeStart'
        : prop === 'rangeEnd'
        ? 'Property:RangeEnd'
        : 'Property:Range';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
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

  async create(input: CreateFilm, session: ISession): Promise<Film> {
    const checkFm = await this.db
      .query()
      .raw(
        `
        MATCH(film:FilmName {value: $name}) return film
        `,
        {
          name: input.name,
        }
      )
      .first();

    if (checkFm) {
      throw new BadRequestException(
        'Film with that name already exists.',
        'Duplicate'
      );
    }
    const id = generate();
    const createdAt = DateTime.local();
    try {
      await this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateFilm' }))
        .create([
          [
            node('newFilm', 'Film:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newFilm'),
          ...this.property('range', input.range ? id : undefined, 'newFilm'),
          ...this.property('rangeStart', input.range?.rangeStart, 'range'),
          ...this.property('rangeEnd', input.range?.rangeEnd, 'range'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('name', 'newFilm'),
          ...this.permission('range', 'newFilm'),
          ...this.permission('rangeStart', 'range'),
          ...this.permission('rangeEnd', 'range'),
        ])
        .return('newFilm.id as id')
        .first();
    } catch (err) {
      this.logger.error(`Could not create film for user ${session.userId}`);
      throw new ServerException('Could not create film');
    }

    this.logger.info(`film created, id ${id}`);

    return this.readOne(id, session);
  }

  async readOne(filmId: string, session: ISession): Promise<Film> {
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
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      range: {
        id: result.id,
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
      },
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateFilm, session: ISession): Promise<Film> {
    const { range, ...name } = input;
    const film = await this.readOne(input.id, session);
    return this.db.sgUpdateProperties({
      session,
      object: film,
      props: ['name'],
      changes: name,
      nodevar: 'film',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const film = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: film,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted film with id`, { id });
  }

  async list(
    { page, count, sort, order, filter }: FilmListInput,
    session: ISession
  ): Promise<FilmListOutput> {
    const result = await this.db.list<Film>({
      session,
      nodevar: 'film',
      aclReadProp: 'canReadFilms',
      aclEditProp: 'canCreateFilm',
      props: ['name', 'range'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
