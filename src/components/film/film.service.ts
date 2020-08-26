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
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  ChildBaseNodeMetaProperty,
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
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  StandardReadResult,
} from '../../core/database/results';
import { ScriptureRange } from '../scripture';
import {
  scriptureToVerseRange,
  verseToScriptureRange,
} from '../scripture/reference';
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
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, ['Film', 'Producible'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .create([...this.permission('scriptureReferences', 'node')]);

      if (input.scriptureReferences) {
        for (const sr of input.scriptureReferences) {
          const verseRange = scriptureToVerseRange(sr);
          query.create([
            node('node'),
            relation('out', '', 'scriptureReferences', { active: true }),
            node('sr', 'ScriptureRange', {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local(),
            }),
          ]);
        }
      }
      query.return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a film');
      }

      this.logger.debug(`flim created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create film`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create film', exception);
    }
  }

  async readOne(filmId: string, session: ISession): Promise<Film> {
    this.logger.debug(`Read film`, {
      id: filmId,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'scriptureReferences',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'ScriptureRange',
        childBaseNodeMetaPropertyKey: '',
        returnIdentifier: '',
      },
    ];
    const readFilm = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('node', 'Film', {
          active: true,
          id: filmId,
        }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .return([
        'propList, permList, node',
        'coalesce(scriptureReferencesReadPerm.read, false) as canScriptureReferencesRead',
        'coalesce(scriptureReferencesEditPerm.edit, false) as canScriptureReferencesEdit',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Film>> & {
          canScriptureReferencesRead: boolean;
          canScriptureReferencesEdit: boolean;
        }
      >();

    const result = await readFilm.first();

    if (!result) {
      throw new NotFoundException('Could not find film', 'film.id');
    }

    const secured = parseSecuredProperties(result.propList, result.permList, {
      name: true,
    });

    const scriptureReferences = await this.listScriptureReferences(
      filmId,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      scriptureReferences: {
        canRead: result.canScriptureReferencesRead,
        canEdit: result.canScriptureReferencesEdit,
        value: scriptureReferences,
      },
    };
  }

  async update(input: UpdateFilm, session: ISession): Promise<Film> {
    const { scriptureReferences } = input;

    if (scriptureReferences) {
      const rel = 'scriptureReferences';
      await this.db
        .query()
        .match([
          node('film', 'Film', { id: input.id, active: true }),
          relation('out', 'rel', rel, { active: true }),
          node('sr', 'ScriptureRange', { active: true }),
        ])
        .setValues({
          'rel.active': false,
          'sr.active': false,
        })
        .return('sr')
        .first();

      for (const sr of scriptureReferences) {
        const verseRange = scriptureToVerseRange(sr);
        await this.db
          .query()
          .match([node('film', 'Film', { id: input.id, active: true })])
          .create([
            node('film'),
            relation('out', '', rel, { active: true }),
            node('', ['ScriptureRange', 'BaseNode'], {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local(),
            }),
          ])
          .return('film')
          .first();
      }
    }
    const film = await this.readOne(input.id, session);
    return await this.db.sgUpdateProperties({
      session,
      object: film,
      props: ['name'],
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
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted film with id`, { id });
  }

  async list(
    { filter, ...input }: FilmListInput,
    session: ISession
  ): Promise<FilmListOutput> {
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = ['name'];
    const label = 'Film';

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);
    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }
    query.call(addAllSecureProperties, ...secureProps).with(
      `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
    );
    const listResult: FilmListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      listResult.items.map((item) => {
        return this.readOne(item.id, session);
      })
    );

    return {
      items,
      hasMore: listResult.hasMore,
      total: listResult.total,
    };
  }

  async listScriptureReferences(
    filmId: string,
    session: ISession
  ): Promise<ScriptureRange[]> {
    const query = this.db
      .query()
      .match([
        node('film', 'Film', {
          id: filmId,
          active: true,
          owningOrgId: session.owningOrgId,
        }),
        relation('out', '', 'scriptureReferences'),
        node('scriptureRanges', 'ScriptureRange', { active: true }),
      ])
      .with('collect(scriptureRanges) as items')
      .return('items');
    const result = await query.first();

    if (!result) {
      return [];
    }

    const items: ScriptureRange[] = await Promise.all(
      result.items.map(
        (item: {
          identity: string;
          labels: string;
          properties: {
            start: number;
            end: number;
            createdAt: string;
            active: boolean;
          };
        }) => {
          return verseToScriptureRange({
            start: item.properties.start,
            end: item.properties.end,
          });
        }
      )
    );

    return items;
  }
}
