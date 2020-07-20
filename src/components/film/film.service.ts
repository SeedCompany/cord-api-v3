import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { DuplicateException, ISession } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
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
    private readonly config: ConfigService
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
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists'
      );
    }
    const id = generate();
    const createdAt = DateTime.local();
    try {
      const query = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateFilm' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newFilm', ['Film', 'Producible', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newFilm'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('name', 'newFilm'),
          ...this.permission('range', 'newFilm'),
          // TODO scriptureReferences
        ])
        .return(
          'newFilm.id as id, requestingUser.canCreateFilm as canCreateFilm'
        );
      await query.first();
    } catch (err) {
      this.logger.error(`Could not create film for user ${session.userId}`);
      throw new ServerException('Could not create film');
    }
    this.logger.info(`film created, id ${id}`);
    return this.readOne(id, session);
  }

  async readOne(filmId: string, session: ISession): Promise<Film> {
    const readFilm = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadFilms' }))
      .match([node('film', 'Film', { active: true, id: filmId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
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
        node('', 'SecurityGroup', { active: true }),
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
        node('', 'SecurityGroup', { active: true }),
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
        node('', 'SecurityGroup', { active: true }),
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
    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateFilm, session: ISession): Promise<Film> {
    const film = await this.readOne(input.id, session);
    return this.db.sgUpdateProperties({
      session,
      object: film,
      props: ['name'], // TODO scriptureReferences
      changes: input,
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
      props: ['name'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
    const items = result.items.length
      ? await Promise.all(
          result.items.map(async (r) => {
            return this.readOne(r.id, session);
          })
        )
      : [];

    return {
      items: (items as unknown) as Film[],
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
