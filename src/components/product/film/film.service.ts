import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
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
import { RangeService } from '../range/range.service';
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
    private readonly db: DatabaseService,
    private readonly rangeService: RangeService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

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
    let film;
    try {
      const query = this.db
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
        ])
        .return(
          'newFilm.id as id, requestingUser.canCreateFilm as canCreateFilm'
        );

      film = await query.first();
    } catch (err) {
      this.logger.error(`Could not create film for user ${session.userId}`);
      throw new ServerException('Could not create film');
    }

    if (input.ranges && film?.canCreateFilm) {
      for (const range of input.ranges) {
        await this.addRange(id, range.start, range.end, session);
      }
    }
    this.logger.info(`film created, id ${id}`);
    return this.readOne(id, session);
  }

  // create a range and add it to a film
  async addRange(
    filmId: string,
    start: number,
    end: number,
    session: ISession
  ): Promise<void> {
    const range = await this.rangeService.create({ start, end }, session);
    if (range) {
      const createdAt = DateTime.local();
      const addMutation = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateFilm' }))
        .match([
          [node('film', 'Film', { active: true, id: filmId })],
          [node('range', 'Range', { active: true, id: range.id })],
        ])
        .create([
          node('film'),
          relation('out', 'rel', 'range', { active: true, createdAt }),
          node('range'),
        ]);
      await addMutation.first();
    }
  }

  async readOne(filmId: string, session: ISession): Promise<Film> {
    const readFilm = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadFilms' }))
      .match([node('film', 'Film', { active: true, id: filmId })])
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
        node('film'),
        relation('out', '', 'name', { active: true }),
        node('name', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditRange', 'Permission', {
          property: 'range',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('film'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('film'),
        relation('out', '', 'range', { active: true }),
        node('rangeNode', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('film'),
      ])

      .return({
        film: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        requestingUser: [
          { canReadFilms: 'canReadFilms', canCreateFilm: 'canCreateFilm' },
        ],
        canReadName: [{ read: 'canReadName' }],
        canEditName: [{ edit: 'canEditName' }],
        rangeNode: [{ value: 'range' }],
        canReadRange: [{ read: 'canReadRange' }],
        canEditRange: [{ edit: 'canEditRange' }],
      });

    let result;
    try {
      result = await readFilm.first();
    } catch {
      throw new ServerException('Read Film Error');
    }
    if (!result) {
      throw new NotFoundException('Could not find film');
    }
    if (!result.canReadFilms) {
      throw new ForbiddenException(
        'User does not have permission to read a film'
      );
    }
    let ranges;
    if (result.rangeNode && result.canReadRange) {
      ranges = await this.rangeService.list(filmId, session);
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      range: ranges ? ranges.items : [],
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
    //TODO update Ranges
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
