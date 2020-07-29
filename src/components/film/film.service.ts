import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DuplicateException, ISession } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
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
      .match([node('film', 'FilmName', { value: input.name })])
      .return('film')
      .first();

    if (checkFm) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'FilmName',
      },
    ];
    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, ['Film', 'Producible'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .create([...this.permission('range', 'node')])
        .call(addUserToSG, 'rootuser', 'adminSG')
        .call(addUserToSG, 'rootuser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a film');
      }

      this.logger.info(`flim created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(`Could not create film for user ${session.userId}`);
      throw new ServerException('Could not create film');
    }
  }

  async readOne(filmId: string, session: ISession): Promise<Film> {
    const secureProps = ['name', 'range'];
    const baseNodeMetaProps = ['id', 'createdAt'];
    const readFilm = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Film', filmId)
      .call(addAllSecureProperties, ...secureProps)
      .return(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)},
            canReadFilms: requestingUser.canReadFilms
          } as film
        `
      );

    const result = await readFilm.first();
    if (!result) {
      throw new NotFoundException('Could not find film');
    }

    if (!result.film.canReadFilms) {
      throw new ForbiddenException(
        'User does not have permission to read a film'
      );
    }

    return {
      id: result.film.id,
      name: result.film.name,
      scriptureReferences: {
        // TODO
        canRead: !!result.film.range.canRead,
        canEdit: !!result.film.range.canEdit,
        value: [],
      },
      createdAt: result.film.createdAt,
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
    { filter, ...input }: FilmListInput,
    session: ISession
  ): Promise<FilmListOutput> {
    const secureProps = ['name', 'range'];
    const label = 'Film';

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);
    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }
    const listResult: {
      items: Array<{
        identity: string;
        labels: string[];
        properties: Film;
      }>;
      hasMore: boolean;
      total: number;
    } = await runListQuery(query, input, secureProps.includes(input.sort));

    const items = await Promise.all(
      listResult.items.map((item) => {
        return this.readOne(item.properties.id, session);
      })
    );

    return {
      items,
      hasMore: listResult.hasMore,
      total: listResult.total,
    };
  }
}
