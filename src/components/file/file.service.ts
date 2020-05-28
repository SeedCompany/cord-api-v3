import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { AWSError } from 'aws-sdk';
import { HeadObjectOutput } from 'aws-sdk/clients/s3';
import { node, Query, relation } from 'cypher-query-builder';
import { camelCase, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, NotImplementedError } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import {
  CreateDefinedFileVersionInput,
  CreateFileVersionInput,
  DefinedFile,
  Directory,
  File,
  FileListInput,
  FileListOutput,
  FileNode,
  FileNodeCategory,
  FileNodeType,
  FileVersion,
  isDirectory,
  isFile,
  isFileVersion,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
  SecuredFile,
} from './dto';
import { FilesBucketToken } from './files-s3-bucket.factory';
import { getCategoryFromMimeType } from './mimeTypes';
import { IS3Bucket } from './s3-bucket';

@Injectable()
export class FileService {
  constructor(
    @Inject(FilesBucketToken) private readonly bucket: IS3Bucket,
    private readonly db: DatabaseService,
    @Logger('file:service') private readonly logger: ILogger
  ) {}

  async getDirectory(id: string, session: ISession): Promise<Directory> {
    const node = await this.getFileNode(id, session);
    if (!isDirectory(node)) {
      throw new BadRequestException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: string, session: ISession): Promise<File> {
    const node = await this.getFileNode(id, session);
    if (!isFile(node)) {
      throw new BadRequestException('Node is not a file');
    }
    return node;
  }

  async getFileVersion(id: string, session: ISession): Promise<FileVersion> {
    const node = await this.getFileNode(id, session);
    if (!isFileVersion(node)) {
      throw new BadRequestException('Node is not a file version');
    }
    return node;
  }

  async getFileNode(id: string, session: ISession): Promise<FileNode> {
    this.logger.info(`getNode`, { id, userId: session.userId });

    const isActive = { active: true };
    const matchNodeProp = (q: Query, prop: string, variable = prop) =>
      q
        .with('*')
        .optionalMatch([
          node('node'),
          relation('out', '', prop, isActive),
          node(variable, 'Property', isActive),
        ]);
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
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [node('node', 'FileNode', { id, ...isActive })],
      ])
      .call(matchNodeProp, 'type')
      .call(matchNodeProp, 'name')
      .with('*')
      .optionalMatch([
        node('node'),
        relation('out', '', 'version', isActive),
        node('fv', 'FileVersion', isActive),
      ])
      .call(matchLatestVersionProp, 'size')
      .call(matchLatestVersionProp, 'mimeType')
      .call(matchLatestVersionProp, 'category')
      .call(matchLatestVersionProp, 'createdAt', 'modifiedAt')
      .return({
        node: [{ id: 'id', createdAt: 'createdAt' }],
        type: [{ value: 'type' }],
        name: [{ value: 'name' }],
        size: [{ value: 'size' }],
        mimeType: [{ value: 'mimeType' }],
        category: [{ value: 'category' }],
        modifiedAt: [{ value: 'modifiedAt' }],
      })
      .first();
    if (!result) {
      throw new NotFoundException();
    }

    const type = result.type as FileNodeType;
    const common = {
      id: result.id,
      name: result.name,
      category: result.category,
      createdAt: result.createdAt,
      createdById: session.userId!, // TODO
    };
    if (type === FileNodeType.Directory) {
      return {
        ...common,
        type: FileNodeType.Directory,
        category: FileNodeCategory.Directory,
      };
    }
    const commonFile = {
      ...common,
      mimeType: result.mimeType,
      size: result.size,
    };
    if (type === FileNodeType.FileVersion) {
      return {
        ...commonFile,
        type: FileNodeType.FileVersion,
      };
    }
    return {
      ...commonFile,
      type: FileNodeType.File,
      modifiedAt: result.modifiedAt,
      modifiedById: session.userId!, // TODO
    };
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    try {
      // before sending link, first check if object exists in s3
      await this.bucket.headObject(fileId);
      return await this.bucket.getSignedUrlForPutObject(fileId);
    } catch (e) {
      this.logger.error('Unable to generate download url', { exception: e });
      throw new ServerException('Unable to generate download url');
    }
  }

  async getParents(
    _nodeId: string,
    _session: ISession
  ): Promise<readonly FileNode[]> {
    throw new NotImplementedError();
  }

  async listChildren(
    _input: FileListInput,
    _session: ISession
  ): Promise<FileListOutput> {
    throw new NotImplementedError();
  }

  async getVersions(
    _fileId: string,
    _session: ISession
  ): Promise<FileVersion[]> {
    throw new NotImplementedError();
  }

  async createDirectory(
    parentId: string | undefined,
    name: string,
    session: ISession
  ): Promise<Directory> {
    const id = generate();
    await this.db.createNode({
      session,
      type: Directory.classType,
      input: {
        id,
        name,
        type: FileNodeType.Directory,
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

    return this.getDirectory(id, session);
  }

  async requestUpload(): Promise<RequestUploadOutput> {
    const id = generate();
    const url = await this.bucket.getSignedUrlForPutObject(`temp/${id}`);
    return { id, url };
  }

  /**
   * Create a new file version.
   * This is always the second step after `requestFileUpload` mutation.
   * If the given parent is a file, this will attach the new version to it.
   * If the given parent is a directory, this will attach the new version to
   * the existing file with the same name or create a new file if not found.
   */
  async createFileVersion(
    { parentId, uploadId, name }: CreateFileVersionInput,
    session: ISession
  ): Promise<File> {
    let upload;
    try {
      upload = await this.bucket.headObject(`temp/${uploadId}`);
    } catch (e) {
      if (
        (e instanceof AWSError && e.code === 'NotFound') ||
        e instanceof NotFoundException
      ) {
        throw new NotFoundException('Could not find upload');
      }
      throw new ServerException('Unable to create file version');
    }

    let parent;
    try {
      parent = await this.getFileNode(parentId, session);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new NotFoundException('Could not find parent');
      }
      throw e;
    }

    if (isFileVersion(parent)) {
      throw new BadRequestException(
        'Only files and directories can be parents of a file version'
      );
    }

    const fileId = isFile(parent)
      ? parent.id
      : await this.getOrCreateFileByName(parent.id, name, session);

    await this.createFileVersionInDb(fileId, uploadId, name, upload, session);

    await this.bucket.moveObject(`temp/${uploadId}`, uploadId);

    return this.getFile(fileId, session);
  }

  private async createFileVersionInDb(
    fileId: string,
    uploadId: string,
    name: string,
    upload: HeadObjectOutput,
    session: ISession
  ) {
    const createdAt = DateTime.local();

    await this.db.createNode({
      session,
      type: FileVersion.classType,
      baseNodeLabel: ['FileVersion', 'FileNode'],
      input: {
        id: uploadId,
        name,
        mimeType: upload.ContentType,
        size: upload.ContentLength,
        category: upload.ContentType
          ? getCategoryFromMimeType(upload.ContentType)
          : FileNodeCategory.Other,
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

    // Add FileNodeCategory label for Prop node between version and category
    await this.db
      .query()
      .match([
        [node('fv', 'FileVersion', { id: uploadId })],
        [
          node('fv'),
          relation('out', 'rel', 'category', { active: true }),
          node('cat', 'Property', { active: true }),
        ],
      ])
      .setLabels({ cat: 'FileNodeCategory' })
      .run();

    await this.attachCreator(uploadId, session);

    // create relationships: file -> version
    await this.db
      .query()
      .match([
        [node('file', 'File', { id: fileId })],
        [node('fv', 'FileVersion', { id: uploadId })],
      ])
      .create([
        [
          node('file'),
          relation('out', '', 'version', { createdAt, active: true }),
          node('fv'),
        ],
      ])
      .run();
  }

  private async getOrCreateFileByName(
    parentId: string,
    name: string,
    session: ISession
  ) {
    // TODO get and return existing file in dir with same name

    return this.createFileInDb(parentId, name, session);
  }

  private async createFileInDb(
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
        type: FileNodeType.File,
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

  async createDefinedFile(
    name: string,
    session: ISession,
    initialVersion?: CreateDefinedFileVersionInput
  ) {
    const fileId = await this.createFileInDb(undefined, name, session);
    if (initialVersion) {
      await this.createFileVersion(
        {
          parentId: fileId,
          uploadId: initialVersion.uploadId,
          name: initialVersion.name ?? name,
        },
        session
      );
    }
    return fileId;
  }

  async updateDefinedFile(
    file: DefinedFile,
    input: CreateDefinedFileVersionInput | undefined,
    session: ISession
  ) {
    if (!input) {
      return;
    }
    if (!file.canRead || !file.canEdit || !file.value) {
      throw new ForbiddenException(
        'You do not have permission to update this file'
      );
    }
    const name = input.name ?? (await this.getFile(file.value, session)).name;
    await this.createFileVersion(
      {
        parentId: file.value,
        uploadId: input.uploadId,
        name,
      },
      session
    );
  }

  async resolveDefinedFile(
    input: DefinedFile,
    session: ISession
  ): Promise<SecuredFile> {
    const { value: fileId, ...rest } = input;
    if (!rest.canRead || !fileId) {
      return rest;
    }
    try {
      const file = await this.getFile(fileId, session);
      return {
        ...rest,
        value: file,
      };
    } catch (e) {
      // DefinedFiles are nullable. This works by creating the file without
      // versions which causes the direct lookup to fail.
      if (e instanceof NotFoundException) {
        return rest;
      }
      throw e;
    }
  }

  async rename(input: RenameFileInput, session: ISession): Promise<FileNode> {
    const fileNode = await this.getFileNode(input.id, session);
    try {
      await this.db.updateProperties({
        session,
        object: fileNode,
        props: ['name'],
        changes: input,
        nodevar: 'fileNode',
      });

      return await this.getFileNode(input.id, session);
    } catch (e) {
      this.logger.error('could not rename', input);
      throw new ServerException('could not rename');
    }
  }

  async move(input: MoveFileInput, session: ISession): Promise<File> {
    if (input.name) {
      await this.rename({ id: input.id, name: input.name }, session);
    }

    try {
      await this.db
        .query()
        .match([
          matchSession(session),
          [node('newParent', [], { id: input.parentId, active: true })],
          [
            node('file', 'FileNode', { id: input.id, active: true }),
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
      this.logger.error('Failed to move', { ...input, exception: e });
      throw new ServerException('Failed to move');
    }

    return this.getFile(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const fileNode = await this.getFileNode(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: fileNode,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
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
