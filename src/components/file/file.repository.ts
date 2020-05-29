import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { camelCase, intersection, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import {
  BaseNode,
  Directory,
  File,
  FileNodeCategory,
  FileNodeType,
  FileVersion,
} from './dto';

@Injectable()
export class FileRepository {
  constructor(
    private readonly db: DatabaseService,
    @Logger('file:repository') private readonly logger: ILogger
  ) {}

  async getBaseNode(id: string, session: ISession): Promise<BaseNode> {
    const isActive = { active: true };
    const query = this.db
      .query()
      .match([
        matchSession(session),
        [node('node', 'FileNode', { id, ...isActive })],
        [
          node('node'),
          relation('out', '', 'name', isActive),
          node('name', 'Property', isActive),
        ],
        [
          node('node'),
          relation('out', '', 'createdBy', isActive),
          node('createdBy'),
        ],
      ])
      .return([
        'node',
        {
          name: [{ value: 'name' }],
          createdBy: [{ id: 'createdById' }],
        },
      ]);
    const result = await query.first();
    if (!result) {
      throw new NotFoundException();
    }

    const base = result.node as Node<{ id: string; createdAt: DateTime }>;
    const type = intersection(base.labels, [
      'Directory',
      'File',
      'FileVersion',
    ])[0] as FileNodeType;

    return {
      type,
      id: base.properties.id,
      name: result.name as string,
      createdAt: base.properties.createdAt,
      createdById: result.createdById as string,
    };
  }

  async getLatestVersionId(fileId: string): Promise<string> {
    const isActive = { active: true };
    const latestVersionResult = await this.db
      .query()
      .match([
        node('node', 'FileNode', { id: fileId, ...isActive }),
        relation('in', '', 'parent', isActive),
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

  async getVersionDetails(id: string, session: ISession): Promise<FileVersion> {
    const isActive = { active: true };
    const matchLatestVersionProp = (q: Query, prop: string, variable = prop) =>
      q
        .with('*')
        .optionalMatch([
          node('requestingUser'),
          relation('in', '', 'member'),
          node('acl', 'ACL', { [camelCase(`canRead-${prop}`)]: true }),
          relation('out', '', 'toNode'),
          node('fv'),
          relation('out', '', prop, isActive),
          node(variable, 'Property', isActive),
        ]);
    const matchFileVersion = node('fv', 'FileVersion', { id, ...isActive });
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [matchFileVersion],
        [
          matchFileVersion,
          relation('out', '', 'name', isActive),
          node('name', 'Property', isActive),
        ],
        [
          matchFileVersion,
          relation('out', '', 'createdBy', isActive),
          node('createdBy'),
        ],
      ])
      .call(matchLatestVersionProp, 'size')
      .call(matchLatestVersionProp, 'mimeType')
      .call(matchLatestVersionProp, 'category')
      .return([
        'fv',
        {
          name: [{ value: 'name' }],
          size: [{ value: 'size' }],
          mimeType: [{ value: 'mimeType' }],
          category: [{ value: 'category' }],
          createdBy: [{ id: 'createdById' }],
        },
      ])
      .first();
    if (!result) {
      throw new NotFoundException();
    }

    const fv = result.fv as Node<{ id: string; createdAt: DateTime }>;

    return {
      id: fv.properties.id,
      type: FileNodeType.FileVersion,
      name: result.name,
      size: result.size as number,
      mimeType: result.mimeType as string,
      category: result.category as FileNodeCategory,
      createdAt: fv.properties.createdAt,
      createdById: result.createdById as string,
    };
  }

  async createDirectory(
    parentId: string | undefined,
    name: string,
    session: ISession
  ): Promise<string> {
    const id = generate();
    await this.db.createNode({
      session,
      type: Directory.classType,
      input: {
        id,
        name,
        createdAt: DateTime.local(),
      },
      acls: {
        canReadName: true,
        canEditName: true,
      },
      baseNodeLabel: ['Directory', 'FileNode'],
      aclEditProp: 'canCreateDirectory',
    });

    await this.attachCreator(id, session);

    if (parentId) {
      await this.attachParent(id, parentId);
    }

    return id;
  }

  async createFile(
    parentId: string | undefined,
    name: string,
    session: ISession
  ) {
    const fileId = generate();
    await this.db.createNode({
      session,
      type: File.classType,
      baseNodeLabel: ['File', 'FileNode'],
      input: {
        id: fileId,
        name,
        createdAt: DateTime.local(),
      },
      acls: {
        canReadParent: true,
        canEditParent: true,
        canReadName: true,
        canEditName: true,
        canReadType: true,
        canEditType: true,
      },
      aclEditProp: 'canCreateFile',
    });

    await this.attachCreator(fileId, session);

    if (parentId) {
      await this.attachParent(fileId, parentId);
    }

    return fileId;
  }

  async createFileVersion(
    fileId: string,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size' | 'category'>,
    session: ISession
  ) {
    const createdAt = DateTime.local();

    await this.db.createNode({
      session,
      type: FileVersion.classType,
      baseNodeLabel: ['FileVersion', 'FileNode'],
      input: {
        ...input,
        createdAt,
      },
      acls: {
        canReadSize: true,
        canEditSize: true,
        canReadParent: true,
        canEditParent: true,
        canReadMimeType: true,
        canEditMimeType: true,
        canReadCategory: true,
        canEditCategory: true,
        canReadName: true,
        canEditName: true,
        canReadModifiedAt: true,
        canEditModifiedAt: true,
      },
    });

    await this.attachCreator(input.id, session);
    await this.attachParent(input.id, fileId);
  }

  private async attachCreator(id: string, session: ISession) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id })],
        [node('user', 'User', { id: session.userId, active: true })],
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

  private async attachParent(id: string, parentId: string) {
    await this.db
      .query()
      .match([
        [node('node', 'FileNode', { id, active: true })],
        [node('parent', 'FileNode', { id: parentId, active: true })],
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
    session: ISession
  ): Promise<void> {
    try {
      await this.db.updateProperty({
        session,
        object: fileNode,
        key: 'name',
        value: newName,
        nodevar: 'fileNode',
      });
    } catch (e) {
      this.logger.error('could not rename', { id: fileNode.id, newName });
      throw new ServerException('could not rename');
    }
  }

  async move(
    id: string,
    newParentId: string,
    session: ISession
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          matchSession(session),
          [node('newParent', [], { id: newParentId, active: true })],
          [
            node('file', 'FileNode', { id, active: true }),
            relation('out', 'rel', 'parent', { active: true }),
            node('oldParent', [], { active: true }),
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
      throw new ServerException('Failed to move');
    }
  }

  async delete(fileNode: BaseNode, session: ISession): Promise<void> {
    try {
      await this.db.deleteNode({
        session,
        object: fileNode,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id: fileNode.id, exception: e });
      throw new ServerException('Failed to delete');
    }
  }

  async checkFileConsistency(
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    // file service creates three base nodes – File, Directory, and FileVersion
    // this function checks consistencty of all three nodes
    const bnode =
      baseNode === 'FileVersion' ? 'FileVersion' : upperFirst(baseNode);
    const fileNodes = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('fileNode', bnode, {
            active: true,
          }),
        ],
      ])
      .return('fileNode.id as id')
      .run();

    const requiredProperties =
      baseNode === 'FileVersion'
        ? ['size', 'mimeType']
        : baseNode === 'File' || baseNode === 'Directory'
        ? ['name']
        : [];
    // for File or Directory
    if (baseNode === 'File' || baseNode === 'Directory') {
      return (
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              ['createdBy', 'parent']
                .map((rel) =>
                  this.db.isRelationshipUnique({
                    session,
                    id: fn.id,
                    relName: rel,
                    srcNodeLabel: `${upperFirst(baseNode)}`,
                  })
                )
                .every((n) => n)
            )
          )
        ).every((n) => n) &&
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              this.db.hasProperties({
                session,
                id: fn.id,
                props: requiredProperties,
                nodevar: `${upperFirst(baseNode)}`,
              })
            )
          )
        ).every((n) => n)
      );
    }
    // for FileVersions
    else if (baseNode === 'FileVersion') {
      return (
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              ['createdBy', 'category']
                .map((rel) =>
                  this.db.isRelationshipUnique({
                    session,
                    id: fn.id,
                    relName: rel,
                    srcNodeLabel: 'FileVersion',
                  })
                )
                .every((n) => n)
            )
          )
        ).every((n) => n) &&
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              this.db.hasProperties({
                session,
                id: fn.id,
                props: requiredProperties,
                nodevar: 'FileVersion',
              })
            )
          )
        ).every((n) => n)
      );
    }
    return false;
  }
}
