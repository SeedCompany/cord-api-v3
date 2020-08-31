import { Injectable } from '@nestjs/common';
import { contains, node, relation } from 'cypher-query-builder';
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
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
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
import { ScriptureRange } from '../scripture';
import {
  scriptureToVerseRange,
  verseToScriptureRange,
} from '../scripture/reference';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterial,
} from './dto';
@Injectable()
export class LiteracyMaterialService {
  constructor(
    @Logger('literacyMaterial:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT n.value IS UNIQUE',
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
      prop === 'name' ? 'Property:LiteracyName' : 'Property:Range';
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

  async create(
    input: CreateLiteracyMaterial,
    session: ISession
  ): Promise<LiteracyMaterial> {
    const checkLiteracy = await this.db
      .query()
      .match([node('literacyMaterial', 'LiteracyName', { value: input.name })])
      .return('literacyMaterial')
      .first();

    if (checkLiteracy) {
      throw new DuplicateException(
        'literacyMaterial.name',
        'Literacy with this name already exists'
      );
    }

    // create literacy-material
    const secureProps: Property[] = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'LiteracyName',
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
        .call(createBaseNode, ['LiteracyMaterial', 'Producible'], secureProps, {
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
        throw new ServerException('failed to create a literacy material');
      }

      this.logger.debug(`literacy material created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create literacy material`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException(
        'Could not create literacy material',
        exception
      );
    }
  }

  async readOne(id: string, session: ISession): Promise<LiteracyMaterial> {
    this.logger.debug(`Read literacyMaterial`, {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const readLiteracyMaterial = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'LiteracyMaterial', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('node, permList, propList')
      .asResult<StandardReadResult<DbPropsOfDto<LiteracyMaterial>>>();

    const result = await readLiteracyMaterial.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find literacy material',
        'literacyMaterial.id'
      );
    }

    const scriptureReferences = await this.listScriptureReferences(id, session);

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      {
        name: true,
        scriptureReferences: true,
      }
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
    };
  }

  async update(
    input: UpdateLiteracyMaterial,
    session: ISession
  ): Promise<LiteracyMaterial> {
    const { scriptureReferences, ...rest } = input;

    if (scriptureReferences) {
      const rel = 'scriptureReferences';
      await this.db
        .query()
        .match([
          node('lm', 'LiteracyMaterial', { id: input.id, active: true }),
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
          .match([
            node('lm', 'LiteracyMaterial', { id: input.id, active: true }),
          ])
          .create([
            node('lm'),
            relation('out', '', rel, { active: true }),
            node('', ['ScriptureRange', 'BaseNode'], {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local(),
            }),
          ])
          .return('lm')
          .first();
      }
    }
    const literacyMaterial = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: literacyMaterial,
      props: ['name'],
      changes: rest,
      nodevar: 'literacyMaterial',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const literacyMaterial = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: literacyMaterial,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted literacyMaterial with id`, { id });
  }

  async list(
    { filter, ...input }: LiteracyMaterialListInput,
    session: ISession
  ): Promise<LiteracyMaterialListOutput> {
    const label = 'LiteracyMaterial';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.name
          ? [
              relation('out', '', 'name', { active: true }),
              node('name', 'Property', { active: true }),
            ]
          : []),
      ])
      .call((q) =>
        filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
      )
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        q
          .match([
            node('node'),
            relation('out', '', sort),
            node('prop', 'Property', { active: true }),
          ])
          .with('*')
          .orderBy('prop.value', order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listScriptureReferences(
    litMaterialId: string,
    session: ISession
  ): Promise<ScriptureRange[]> {
    const query = this.db
      .query()
      .match([
        node('lt', 'LiteracyMaterial', {
          id: litMaterialId,
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
