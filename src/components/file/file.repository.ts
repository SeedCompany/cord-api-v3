import { Injectable } from '@nestjs/common';
import { entries, mapKeys } from '@seedcompany/common';
import {
  contains,
  hasLabel,
  inArray,
  isNull,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import { type Direction } from 'cypher-query-builder/dist/typings/clauses/order-by';
import { type AnyConditions } from 'cypher-query-builder/dist/typings/clauses/where-utils';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  type ID,
  NotFoundException,
  ServerException,
  type Session,
} from '~/common';
import { ILogger, type LinkTo, Logger } from '~/core';
import { CommonRepository, OnIndex } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createProperty,
  createRelationships,
  currentUser,
  matchProps,
  merge,
  paginate,
  sorting,
  variable,
} from '~/core/database/query';
import { type BaseNode } from '~/core/database/results';
import {
  Directory,
  File,
  FileListInput,
  type FileNode,
  FileNodeType,
  FileVersion,
  IFileNode,
  resolveFileNode,
} from './dto';

@Injectable()
export class FileRepository extends CommonRepository {
  constructor(@Logger('file:repository') private readonly logger: ILogger) {
    super();
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IFileNode);
  }

  async getById(id: ID): Promise<FileNode> {
    const result = await this.db
      .query()
      .matchNode('node', 'FileNode', { id })
      .apply(this.hydrate())
      .map('dto')
      .run();
    return first(result);
  }

  async getByIds(ids: readonly ID[]) {
    return await this.db
      .query()
      .matchNode('node', 'FileNode')
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async getByName(parentId: ID, name: string): Promise<FileNode> {
    const result = await this.db
      .query()
      .match([
        node('parent', 'FileNode', { id: parentId }),
        relation('in', '', 'parent', ACTIVE),
        node('node', 'FileNode'),
        relation('out', '', 'name', ACTIVE),
        node('name', 'Property', { value: name }),
      ])
      .apply(this.hydrate())
      .map('dto')
      .run();
    return first(result);
  }

  async getParentsById(id: ID): Promise<readonly FileNode[]> {
    const result = await this.db
      .query()
      .match([
        node('start', 'FileNode', { id }),
        relation('out', 'parent', 'parent', ACTIVE, '*'),
        node('node', 'FileNode'),
      ])
      .with('node, parent')
      .orderBy('size(parent)')
      // Using paginate to maintain order through hydration
      .apply(paginate({ page: 1, count: 100 }, this.hydrate()))
      .first();
    return result!.items;
  }

  async getChildrenById(parent: FileNode, input?: FileListInput) {
    input ??= FileListInput.defaultValue(FileListInput);
    const result = await this.db
      .query()
      .match([
        node('start', 'FileNode', { id: parent.id }),
        relation('in', '', 'parent', ACTIVE),
        node('node', 'FileNode'),
      ])
      .apply((q) => {
        const conditions: AnyConditions = {};
        if (input?.filter?.name) {
          q.match([
            node('node'),
            relation('out', '', 'name', ACTIVE),
            node('name', 'Property'),
          ]);
          conditions['name.value'] = contains(input.filter.name);
        }
        if (input?.filter?.type) {
          conditions.node = hasLabel(input.filter.type);
        }
        return entries(conditions).length === 0 ? q : q.where(conditions);
      })
      .apply(sorting(resolveFileNode(parent), input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!;
  }

  hydrate() {
    return (query: Query) =>
      query
        .subQuery((sub) =>
          sub
            .with('node')
            .with('node')
            .where({ node: hasLabel(FileNodeType.File) })
            .apply(this.hydrateFile())
            .union()
            .with('node')
            .with('node')
            .where({ node: hasLabel(FileNodeType.FileVersion) })
            .apply(this.hydrateFileVersion())
            .union()
            .with('node')
            .with('node')
            .where({ node: hasLabel(FileNodeType.Directory) })
            .apply(this.hydrateDirectory()),
        )
        .subQuery('node', (sub) =>
          sub
            .raw('MATCH p=(node)-[:parent*0..]->(root:FileNode)')
            .return('root')
            .orderBy('length(p)', 'DESC')
            .raw('LIMIT 1'),
        )
        .subQuery('root', (sub) =>
          sub
            .raw('MATCH (resource:BaseNode)-[rel]->(root)')
            // Need to filter out FileNodes which are children of this dir
            // (the schema was mistakenly pointing these relationships in the wrong direction)
            // Also filter to ACTIVE, if applicable.
            .raw(
              'WHERE NOT resource:FileNode AND coalesce(rel.active, true) <> false',
            )
            .return('[resource, type(rel)] as rootAttachedTo'),
        )
        .return<{ dto: FileNode }>(
          merge(
            'dto',
            mapKeys.fromList(['root', 'rootAttachedTo'], (k) => k).asRecord,
          ).as('dto'),
        );
  }

  private hydrateFile() {
    return (query: Query) =>
      query
        .apply(this.matchLatestVersion())
        .apply(matchProps())
        .apply(matchProps({ nodeName: 'version', outputVar: 'versionProps' }))
        .match([
          node('node'),
          relation('out', '', 'createdBy', ACTIVE),
          node('createdBy'),
        ])
        .match([
          node('version'),
          relation('out', '', 'createdBy', ACTIVE),
          node('modifiedBy'),
        ])
        .return<{ dto: File }>(
          merge({ public: false }, 'versionProps', 'props', {
            type: `"${FileNodeType.File}"`,
            latestVersionId: 'version.id',
            modifiedById: 'modifiedBy.id',
            modifiedAt: 'version.createdAt',
            createdById: 'createdBy.id',
            canDelete: true,
          }).as('dto'),
        );
  }

  private hydrateDirectory() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('out', '', 'createdBy', ACTIVE),
          node('createdBy'),
        ])
        // Fetch directory info determined by children
        .subQuery('node', (sub) =>
          sub
            // region Match all files (with active versions) from all subdirectories
            .optionalMatch([
              node('node'),
              relation('in', '', 'parent', ACTIVE, '*'),
              node('file', 'File'),
              relation('in', '', 'parent', ACTIVE),
              node('', 'FileVersion'),
            ])
            // endregion
            // region For each file, grab the first & latest version
            .subQuery('file', (sub) =>
              sub
                .match([
                  node('file'),
                  relation('in', '', 'parent', ACTIVE),
                  node('version', 'FileVersion'),
                ])
                .with('version')
                .orderBy('version.createdAt')
                .with('collect(version) as versions')
                .return([
                  'versions[0] as firstVersion',
                  'versions[-1] as latestVersion',
                ]),
            )
            // endregion
            // region For each latest file version grab its size
            .optionalMatch([
              node('latestVersion'),
              relation('out', '', 'size', ACTIVE),
              node('size'),
            ])
            // endregion
            // region Group up file info
            // This reduces back down to a single row per directory node
            .with([
              // distinct files here as each row is a different version of one file
              'count(distinct file) as totalFiles',
              'sum(size.value) as size',
              'collect(latestVersion) as latestVersions',
              'collect(firstVersion) as firstVersions',
            ])
            // endregion
            // region Of all the file's first/last versions, grab the min/max
            .apply(singleVersionFrom('firstVersions', 'firstVersion', 'asc'))
            .apply(singleVersionFrom('latestVersions', 'latestVersion', 'desc'))
            // endregion
            .optionalMatch([
              node('latestVersion'),
              relation('out', '', 'createdBy', ACTIVE),
              node('modifiedBy'),
            ])
            .optionalMatch([
              node('firstVersion'),
              relation('out', '', 'parent', ACTIVE),
              node('firstFile', 'File'),
            ])
            .return([
              'totalFiles',
              'size',
              'firstFile',
              'latestVersion',
              'modifiedBy',
            ]),
        )
        .return<{ dto: Directory }>(
          merge({ public: false }, 'props', {
            type: `"${FileNodeType.Directory}"`,
            createdById: 'createdBy.id',
            totalFiles: 'totalFiles',
            size: 'size',
            firstFileCreated: 'firstFile.id',
            modifiedBy: 'coalesce(modifiedBy, createdBy).id',
            modifiedAt: 'coalesce(latestVersion, node).createdAt',
            canDelete: true,
          }).as('dto'),
        );

    function singleVersionFrom(list: string, out: string, order: Direction) {
      return (query: Query) =>
        query.subQuery(list, (sub) =>
          sub
            .raw(`UNWIND ${list} as version`)
            .with('version')
            .orderBy('version.createdAt', order)
            .return(`version as ${out}`)
            .raw('LIMIT 1')
            .union()
            .with(list)
            .with(list)
            .raw(`WHERE size(${list}) = 0`)
            .return(`null as ${out}`),
        );
    }
  }

  private hydrateFileVersion() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('out', '', 'createdBy', ACTIVE),
          node('createdBy'),
        ])
        .return<{ dto: FileVersion }>(
          merge({ public: false }, 'props', {
            type: `"${FileNodeType.FileVersion}"`,
            createdById: 'createdBy.id',
            canDelete: true,
          }).as('dto'),
        );
  }

  private matchLatestVersion() {
    return (query: Query) =>
      query.subQuery('node', (sub) =>
        sub
          .match([
            node('node', 'FileNode'),
            relation('in', '', 'parent', ACTIVE),
            node('version', 'FileVersion'),
          ])
          .return('version')
          .orderBy('version.createdAt', 'DESC')
          .raw('LIMIT 1'),
      );
  }

  async getBaseNode(id: ID) {
    return await this.db
      .query()
      .matchNode('node', 'FileNode', { id })
      .return<{ node: BaseNode }>('node')
      .map('node')
      .first();
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    session: Session,
    { public: isPublic }: { public?: boolean } = {},
  ): Promise<ID> {
    const initialProps = {
      name,
      ...(isPublic ? { public: true } : {}),
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(await createNode(Directory, { initialProps }))
      .apply(
        createRelationships(Directory, 'out', {
          createdBy: currentUser,
          parent: ['Directory', parentId],
        }),
      )
      .apply(this.defaultPublicFromParent(isPublic))
      .return<{ id: ID }>('node.id as id');

    const result = await createFile.first();
    if (!result) {
      throw new CreationFailed(Directory);
    }
    return result.id;
  }

  async createRootDirectory({
    resource,
    relation,
    name,
    public: isPublic,
    session,
  }: {
    resource: LinkTo<any>;
    relation: string;
    name: string;
    public?: boolean;
    session: Session;
  }) {
    const initialProps = {
      name,
      public: isPublic,
    };

    const query = this.db
      .query()
      .apply(await createNode(Directory, { initialProps }))
      .apply(
        createRelationships(Directory, {
          in: { [relation]: ['BaseNode', resource.id] },
          out: { createdBy: currentUser },
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new CreationFailed(Directory);
    }
    return result.id;
  }

  async createFile({
    fileId,
    name,
    session,
    parentId,
    propOfNode,
    public: isPublic,
  }: {
    fileId: ID;
    name: string;
    session: Session;
    parentId?: ID;
    propOfNode?: [baseNodeId: ID, propertyName: string];
    public?: boolean;
  }) {
    const initialProps = {
      name,
      ...(isPublic ? { public: true } : {}),
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(
        await createNode(File, { initialProps, baseNodeProps: { id: fileId } }),
      )
      .apply(
        createRelationships(File, {
          out: {
            createdBy: currentUser,
            parent: ['Directory', parentId],
          },
          in: {
            [propOfNode?.[1] ?? '']: ['BaseNode', propOfNode?.[0]],
          },
        }),
      )
      .apply(this.defaultPublicFromParent(isPublic))
      .return<{ id: ID }>('node.id as id');

    const result = await createFile.first();
    if (!result) {
      throw new CreationFailed(File);
    }
    return result.id;
  }

  async createFileVersion(
    fileId: ID,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size'> & {
      public?: boolean;
    },
    session: Session,
  ) {
    const initialProps = {
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      ...(input.public ? { public: true } : {}),
      canDelete: true,
    };

    const createFile = this.db
      .query()
      .apply(
        await createNode(FileVersion, {
          initialProps,
          baseNodeProps: { id: input.id },
        }),
      )
      .apply(
        createRelationships(FileVersion, 'out', {
          createdBy: currentUser,
          parent: ['File', fileId],
        }),
      )
      .apply(this.defaultPublicFromParent(input.public))
      .apply(this.hydrate());

    const result = await createFile.first();
    if (!result) {
      throw new CreationFailed(FileVersion);
    }
    return result.dto as FileVersion;
  }

  async rename(fileNode: FileNode, newName: string): Promise<void> {
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

  async move(id: ID, newParentId: ID): Promise<void> {
    try {
      await this.db
        .query()
        .match([
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

  async delete(fileNode: FileNode): Promise<void> {
    try {
      await this.db.deleteNode(fileNode);
    } catch (exception) {
      this.logger.error('Failed to delete', { id: fileNode.id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  private defaultPublicFromParent(explicitPublic?: boolean) {
    return (query: Query) => {
      if (explicitPublic != null) {
        // public flag has been explicitly set, so not defaulting from parent.
        return query;
      }
      return query.subQuery('node', (sub) =>
        sub.raw`
            MATCH (node)-[:parent { active: true }]->
                  (:FileNode)-[:public { active: true }]->(prop:Property)
          `
          .where({ 'prop.value': not(isNull()) })
          .apply(
            createProperty({
              key: 'public',
              value: variable('prop.value'),
              resource: IFileNode,
            }),
          )
          .return('count(prop) as appliedPublicFromParent'),
      );
    };
  }
}

function first<T>(nodes: readonly T[]): T {
  const node = nodes[0];
  if (!node) {
    throw new NotFoundException();
  }
  return node;
}
