import { Injectable } from '@nestjs/common';
import { contains, hasLabel, node, relation } from 'cypher-query-builder';
import type { Pattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import { AnyConditions } from 'cypher-query-builder/dist/typings/clauses/where-utils';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
} from '../../core';
import {
  ACTIVE,
  collect,
  count,
  createNode,
  matchProps,
  merge,
} from '../../core/database/query';
import { hasMore } from '../../core/database/results';
import {
  BaseNode,
  Directory,
  File,
  FileListInput,
  FileVersion,
  IFileNode,
} from './dto';

@Injectable()
export class FileRepository {
  constructor(
    private readonly db: DatabaseService,
    @Logger('file:repository') private readonly logger: ILogger
  ) {}

  async getBaseNodeById(id: ID, session: Session): Promise<BaseNode> {
    return await this.getBaseNodeBy(session, [
      [node('node', 'FileNode', { id })],
      matchName(),
    ]);
  }

  async getBaseNodeByName(
    parentId: ID,
    name: string,
    session: Session
  ): Promise<BaseNode> {
    return await this.getBaseNodeBy(session, [
      [
        node('parent', 'FileNode', { id: parentId }),
        relation('in', '', 'parent', ACTIVE),
        node('node', 'FileNode'),
        relation('out', '', 'name', ACTIVE),
        node('name', 'Property', { value: name }),
      ],
    ]);
  }

  async getParentsById(id: ID, session: Session): Promise<readonly BaseNode[]> {
    const query = this.getBaseNodeQuery(session, [
      [
        node('start', 'FileNode', { id }),
        relation('out', 'parent', 'parent', ACTIVE, '*'),
        node('node', 'FileNode'),
      ],
      matchName(),
    ]);
    query.orderBy('size(parent)');
    return await query.run();
  }

  async getChildrenById(
    session: Session,
    nodeId: ID,
    options: FileListInput | undefined
  ) {
    options = options ?? FileListInput.defaultVal;
    const query = this.db
      .query()
      .match([
        matchSession(session),
        [
          node('start', 'FileNode', { id: nodeId }),
          relation('in', '', 'parent', ACTIVE),
          node('node', 'FileNode'),
        ],
        matchCreatedBy(),
        matchName(),
      ])
      .apply((q) => {
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
        collect({
          id: 'node.id',
          createdAt: 'node.createdAt',
          type: typeFromLabel('node'),
          name: 'name.value',
          createdById: 'createdBy.id',
        }).as('nodes'),
        count('DISTINCT node').as('total'),
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
  ): Promise<readonly BaseNode[]> {
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

  async getLatestVersionId(fileId: ID): Promise<ID> {
    const latestVersionResult = await this.db
      .query()
      .match([
        node('node', 'FileNode', { id: fileId }),
        relation('in', '', 'parent', ACTIVE),
        node('fv', 'FileVersion'),
      ])
      .return<{ id: ID }>('fv.id as id')
      .orderBy('fv.createdAt', 'DESC')
      .limit(1)
      .first();
    if (!latestVersionResult) {
      throw new NotFoundException();
    }
    return latestVersionResult.id;
  }

  async getVersionDetails(id: ID, session: Session): Promise<FileVersion> {
    const query = this.db
      .query()
      .match(node('node', 'FileVersion', { id }))
      .apply(matchProps())
      .match([
        node('node'),
        relation('out', '', 'createdBy', ACTIVE),
        node('createdBy'),
      ])
      .return<{ dto: UnsecuredDto<FileVersion> }>(
        merge('props', {
          type: typeFromLabel('node'),
          createdById: 'createdBy.id',
        }).as('dto')
      );

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find file version');
    }
    return {
      ...result.dto,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    session: Session
  ): Promise<ID> {
    const initialProps = {
      name,
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Directory, { initialProps }))
      .return<{ id: ID }>('node.id as id');

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

  async createFile(fileId: ID, name: string, session: Session, parentId?: ID) {
    const initialProps = {
      name,
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        await createNode(File, { initialProps, baseNodeProps: { id: fileId } })
      )
      .return<{ id: ID }>('node.id as id');

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
    fileId: ID,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size'>,
    session: Session
  ) {
    const initialProps = {
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        await createNode(FileVersion, {
          initialProps,
          baseNodeProps: { id: input.id },
        })
      )
      .return<{ id: ID }>('node.id as id');

    const result = await createFile.first();

    if (!result) {
      throw new ServerException('Failed to create file version');
    }

    await this.attachCreator(input.id, session);
    await this.attachParent(input.id, fileId);

    return result;
  }

  private async attachCreator(id: ID, session: Session) {
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

  async attachBaseNode(id: ID, baseNodeId: ID, attachName: string) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('attachNode', 'BaseNode', { id: baseNodeId })],
      ])
      .create([
        node('node'),
        relation('in', '', attachName, ACTIVE),
        node('attachNode'),
      ])
      .run();
  }

  private async attachParent(id: ID, parentId: ID) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('parent', 'FileNode', { id: parentId })],
      ])
      .create([
        node('node'),
        relation('out', '', 'parent', ACTIVE),
        node('parent'),
      ])
      .run();
  }

  async rename(fileNode: BaseNode, newName: string): Promise<void> {
    // TODO Do you have permission to rename the file?
    try {
      await this.db.updateProperty({
        type: IFileNode,
        object: fileNode,
        key: 'name',
        value: newName,
      });
    } catch (e) {
      this.logger.error('Could not rename', { id: fileNode.id, newName });
      throw new ServerException('Could not rename file node', e);
    }
  }

  async move(id: ID, newParentId: ID, session: Session): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          matchSession(session),
          [node('newParent', [], { id: newParentId })],
          [
            node('file', 'FileNode', { id }),
            relation('out', 'rel', 'parent', ACTIVE),
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

    try {
      await this.db.deleteNode(fileNode);
    } catch (exception) {
      this.logger.error('Failed to delete', { id: fileNode.id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }
}

const matchName = () => [
  node('node'),
  relation('out', '', 'name', ACTIVE),
  node('name', 'Property'),
];
const matchCreatedBy = () => [
  node('node'),
  relation('out', '', 'createdBy', ACTIVE),
  node('createdBy', 'User'),
];

function first<T>(nodes: readonly T[]): T {
  const node = nodes[0];
  if (!node) {
    throw new NotFoundException();
  }
  return node;
}

const typeFromLabel = (variable: string) =>
  `[l in labels(${variable}) where l in ['FileVersion', 'File', 'Directory']][0]`;
