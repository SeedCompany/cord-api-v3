import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { contains, hasLabel, node, relation } from 'cypher-query-builder';
import type { Pattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import { AnyConditions } from 'cypher-query-builder/dist/typings/clauses/where-utils';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNodeNew,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import {
  collect,
  count,
  mapping,
  matchPropListNew,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  hasMore,
  parseBaseNodeProperties,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { BaseNode, FileListInput, FileNodeType, FileVersion } from './dto';
import { DbFileVersion } from './model/file-version.model.db';

@Injectable()
export class FileRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('file:repository') private readonly logger: ILogger
  ) {}

  async getBaseNodeById(id: string, session: Session): Promise<BaseNode> {
    return await this.getBaseNodeBy(session, [
      [node('node', 'FileNode', { id })],
      matchName(),
    ]);
  }

  async getBaseNodeByName(
    parentId: string,
    name: string,
    session: Session
  ): Promise<BaseNode> {
    return await this.getBaseNodeBy(session, [
      [
        node('parent', 'FileNode', { id: parentId }),
        relation('in', '', 'parent', { active: true }),
        node('node', 'FileNode'),
        relation('out', '', 'name', { active: true }),
        node('name', 'Property', { value: name }),
      ],
    ]);
  }

  async getParentsById(id: string, session: Session): Promise<BaseNode[]> {
    const query = this.getBaseNodeQuery(session, [
      [
        node('start', 'FileNode', { id }),
        relation('out', 'parent', 'parent', { active: true }, '*'),
        node('node', 'FileNode'),
      ],
      matchName(),
    ]);
    query.orderBy('size(parent)');
    return await query.run();
  }

  async getChildrenById(
    session: Session,
    nodeId: string,
    options: FileListInput | undefined
  ) {
    options = options ?? FileListInput.defaultVal;
    const query = this.db
      .query()
      .match([
        matchSession(session),
        [
          node('start', 'FileNode', { id: nodeId }),
          relation('in', '', 'parent', { active: true }),
          node('node', 'FileNode'),
        ],
        matchCreatedBy(),
        matchName(),
      ])
      .call((q) => {
        const conditions: AnyConditions = {};
        if (options?.filter?.name) {
          conditions['name.value'] = contains(options.filter.name);
        }
        if (options?.filter?.type) {
          conditions.node = hasLabel(options.filter.type);
        }
        return isEmpty(conditions) ? q : q.where(conditions);
      })
      .with([
        collect(
          mapping('node', ['id', 'createdAt'], {
            type: typeFromLabel('node'),
            name: 'name.value',
            createdById: 'createdBy.id',
          }),
          'nodes'
        ),
        count('node', { as: 'total', distinct: true }),
      ])
      .raw('unwind nodes as node')
      .return(['node', 'total'])
      .orderBy('node.' + options.sort, options.order)
      .skip((options.page - 1) * options.count)
      .limit(options.count)
      .asResult<{ node: BaseNode; total: number }>();

    const result = await query.run();
    const total = result[0]?.total ?? 0;
    const children = result.map((r) => r.node);

    return {
      children,
      total,
      hasMore: hasMore(options, total),
    };
  }

  private async getBaseNodeBy(
    session: Session,
    patterns: Pattern[][]
  ): Promise<BaseNode> {
    const nodes = await this.getBaseNodesBy(session, patterns);
    return first(nodes);
  }

  private async getBaseNodesBy(
    session: Session,
    patterns: Pattern[][]
  ): Promise<BaseNode[]> {
    const query = this.getBaseNodeQuery(session, patterns);
    const results = await query.run();
    return results;
  }

  private getBaseNodeQuery(session: Session, patterns: Pattern[][]) {
    this.db.assertPatternsIncludeIdentifier(patterns, 'node', 'name');

    const query = this.db
      .query()
      .match([matchSession(session), ...patterns, matchCreatedBy()])
      .return([
        `${typeFromLabel('node')} as type`,
        {
          node: [{ id: 'id', createdAt: 'createdAt' }],
          name: [{ value: 'name' }],
          createdBy: [{ id: 'createdById' }],
        },
      ])
      .asResult<BaseNode>();
    return query;
  }

  async getLatestVersionId(fileId: string): Promise<string> {
    const latestVersionResult = await this.db
      .query()
      .match([
        node('node', 'FileNode', { id: fileId }),
        relation('in', '', 'parent', { active: true }),
        node('fv', 'FileVersion'),
      ])
      .return('fv')
      .orderBy('fv.createdAt', 'DESC')
      .limit(1)
      .first();
    if (!latestVersionResult) {
      throw new NotFoundException();
    }
    return latestVersionResult.fv.properties.id;
  }

  async getVersionDetails(id: string, session: Session): Promise<FileVersion> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'FileNode', { id })])
      .call(matchPropListNew, 'node')
      .match([
        node('fv', 'FileVersion', { id }),
        relation('out', '', 'createdBy', { active: true }),
        node('createdBy'),
      ])
      .match([
        node('fv', 'FileVersion'),
        relation('out', '', 'parent', { active: true }),
        node('parent'),
      ])
      .return([
        'propList, node',
        { createdBy: [{ id: 'createdById' }], parent: [{ id: 'parent' }] },
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<FileVersion>> & {
          createdById: string;
          parent: string;
        }
      >();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find file version',
        'fileversion.id'
      );
    }
    if (!result) {
      throw new NotFoundException();
    }

    const securedProperties = {
      category: true,
      createdBy: true,
      mimeType: true,
      name: true,
      parent: true,
      size: true,
    };

    const completePropList = [
      ...result.propList,
      { property: 'createdBy', value: result.createdById },
      { property: 'parent', value: result.parent },
    ];

    const secured = await this.authorizationService.getPermissionsOfBaseNode({
      baseNode: new DbFileVersion(),
      sessionOrUserId: session,
      propList: completePropList,
      propKeys: securedProperties,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...{
        category: secured.category.canRead ? secured.category.value : null,
        createdById: secured.createdBy.canRead ? secured.createdBy.value : null,
        mimeType: secured.mimeType.canRead ? secured.mimeType.value : null,
        name: secured.name.canRead ? secured.name.value : null,
        parent: secured.parent.canRead ? secured.parent.value : null,
        size: secured.size.canRead ? secured.size.value : null,
        type: FileNodeType.FileVersion,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async createDirectory(
    parentId: string | undefined,
    name: string,
    session: Session
  ): Promise<string> {
    const props: Property[] = [
      {
        key: 'name',
        value: name,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const createFile = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(
        createBaseNodeNew,
        await generateId(),
        ['Directory', 'FileNode'],
        props
      )
      .return('node.id as id')
      .asResult<{ id: string }>();

    const result = await createFile.first();

    if (!result) {
      throw new ServerException('Failed to create directory');
    }

    await this.attachCreator(result.id, session);

    if (parentId) {
      await this.attachParent(result.id, parentId);
    }

    return result.id;
  }

  async createFile(
    fileId: string,
    name: string,
    session: Session,
    parentId?: string
  ) {
    const props: Property[] = [
      {
        key: 'name',
        value: name,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const createFile = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(createBaseNodeNew, fileId, ['File', 'FileNode'], props)
      .return('node.id as id')
      .asResult<{ id: string }>();

    const result = await createFile.first();

    if (!result) {
      throw new ServerException('Failed to create file');
    }

    await this.attachCreator(result.id, session);

    if (parentId) {
      await this.attachParent(result.id, parentId);
    }

    return result.id;
  }

  async createFileVersion(
    fileId: string,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size'>,
    session: Session
  ) {
    const props: Property[] = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mimeType',
        value: input.mimeType,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'size',
        value: input.size,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const createFile = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(createBaseNodeNew, input.id, ['FileVersion', 'FileNode'], props)
      .return('node.id as id')
      .asResult<{ id: string }>();

    const result = await createFile.first();

    if (!result) {
      throw new ServerException('Failed to create file version');
    }

    await this.attachCreator(input.id, session);
    await this.attachParent(input.id, fileId);

    return result;
  }

  private async attachCreator(id: string, session: Session) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('user', 'User', { id: session.userId })],
      ])
      .create([
        node('node'),
        relation('out', '', 'createdBy', {
          createdAt: DateTime.local(),
          active: true,
        }),
        node('user'),
      ])
      .run();
  }

  async attachBaseNode(id: string, baseNodeId: string, attachName: string) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('attachNode', 'BaseNode', { id: baseNodeId })],
      ])
      .create([
        node('node'),
        relation('in', '', attachName, { active: true }),
        node('attachNode'),
      ])
      .run();
  }

  private async attachParent(id: string, parentId: string) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('parent', 'FileNode', { id: parentId })],
      ])
      .create([
        node('node'),
        relation('out', '', 'parent', { active: true }),
        node('parent'),
      ])
      .run();
  }

  async rename(
    fileNode: BaseNode,
    newName: string,
    session: Session
  ): Promise<void> {
    try {
      await this.db.sgUpdateProperty({
        session,
        object: fileNode,
        key: 'name',
        value: newName,
        nodevar: 'fileNode',
      });
    } catch (e) {
      this.logger.error('could not rename', { id: fileNode.id, newName });
      throw new ServerException('could not rename', e);
    }
  }

  async move(id: string, newParentId: string, session: Session): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          matchSession(session),
          [node('newParent', [], { id: newParentId })],
          [
            node('file', 'FileNode', { id }),
            relation('out', 'rel', 'parent', { active: true }),
            node('oldParent', []),
          ],
        ])
        .delete('rel')
        .create([
          node('newParent'),
          relation('in', '', 'parent', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('file'),
        ])
        .run();
    } catch (e) {
      this.logger.error('Failed to move', { id, newParentId, exception: e });
      throw new ServerException('Failed to move', e);
    }
  }

  async delete(fileNode: BaseNode, session: Session): Promise<void> {
    const canDelete = await this.db.checkDeletePermission(fileNode.id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this File item'
      );

    const baseNodeLabels = ['BaseNode', fileNode.type];

    try {
      await this.db.deleteNodeNew({
        object: fileNode,
        baseNodeLabels,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id: fileNode.id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async checkConsistency(type: FileNodeType, session: Session): Promise<void> {
    const fileNodes = await this.db
      .query()
      .matchNode('fileNode', type)
      .return('fileNode.id as id')
      .run();

    const requiredProperties =
      type === FileNodeType.FileVersion ? ['size', 'mimeType'] : ['name'];
    const uniqueRelationships = ['createdBy', 'parent'];

    for (const fn of fileNodes) {
      const id = fn.id as string;
      for (const rel of uniqueRelationships) {
        const unique = await this.db.isRelationshipUnique({
          session,
          id,
          relName: rel,
          srcNodeLabel: type,
        });
        if (!unique) {
          throw new Error(`Node ${id} has multiple ${rel} relationships`);
        }
      }
      for (const prop of requiredProperties) {
        const hasIt = await this.db.hasProperty({
          session,
          id,
          prop,
          nodevar: type,
        });
        if (!hasIt) {
          throw new Error(`Node ${id} is missing ${prop}`);
        }
      }
    }
  }
}

const matchName = () => [
  node('node'),
  relation('out', '', 'name', { active: true }),
  node('name', 'Property'),
];
const matchCreatedBy = () => [
  node('node'),
  relation('out', '', 'createdBy', { active: true }),
  node('createdBy', 'User'),
];

function first<T>(nodes: T[]): T {
  const node = nodes[0];
  if (!node) {
    throw new NotFoundException();
  }
  return node;
}

const typeFromLabel = (variable: string) =>
  `[l in labels(${variable}) where l in ['FileVersion', 'File', 'Directory']][0]`;
