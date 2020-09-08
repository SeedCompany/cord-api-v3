import { Inject, Injectable } from '@nestjs/common';
import { AWSError } from 'aws-sdk';
import { generate } from 'shortid';
import {
  DuplicateException,
  InputException,
  ISession,
  NotFoundException,
  ServerException,
  UnauthorizedException,
} from '../../common';
import { ILogger, Logger } from '../../core';
import { FileBucket } from './bucket';
import {
  BaseNode,
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
  isDirectoryNode,
  isFile,
  isFileNode,
  isFileVersion,
  isFileVersionNode,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
  SecuredFile,
} from './dto';
import { FileRepository } from './file.repository';
import { FilesBucketToken } from './files-bucket.factory';
import { getCategoryFromMimeType } from './mimeTypes';

@Injectable()
export class FileService {
  constructor(
    @Inject(FilesBucketToken) private readonly bucket: FileBucket,
    private readonly repo: FileRepository,
    @Logger('file:service') private readonly logger: ILogger
  ) {}

  async getDirectory(id: string, session: ISession): Promise<Directory> {
    const node = await this.getFileNode(id, session);
    if (!isDirectory(node)) {
      throw new InputException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: string, session: ISession): Promise<File> {
    const node = await this.getFileNode(id, session);
    if (!isFile(node)) {
      throw new InputException('Node is not a file');
    }
    return node;
  }

  async getFileVersion(id: string, session: ISession): Promise<FileVersion> {
    const node = await this.getFileNode(id, session);
    if (!isFileVersion(node)) {
      throw new InputException('Node is not a file version');
    }
    return node;
  }

  async getFileNode(id: string, session: ISession): Promise<FileNode> {
    this.logger.debug(`getNode`, { id, userId: session.userId });

    const base = await this.repo.getBaseNodeById(id, session);
    return await this.adaptBaseNodeToFileNode(base, session);
  }

  private async adaptBaseNodeToFileNode(
    node: BaseNode,
    session: ISession
  ): Promise<FileNode> {
    if (node.type === FileNodeType.Directory) {
      return {
        ...node,
        type: FileNodeType.Directory,
        category: FileNodeCategory.Directory,
      };
    }

    if (node.type === FileNodeType.FileVersion) {
      const version = await this.repo.getVersionDetails(node.id, session);
      return version;
    }

    const latestVersionId = await this.repo.getLatestVersionId(node.id);
    const version = await this.repo.getVersionDetails(latestVersionId, session);
    return {
      ...version,
      ...node,
      type: FileNodeType.File,
      latestVersionId,
      modifiedAt: version.createdAt,
      modifiedById: version.createdById,
    };
  }

  async getDownloadUrl(node: FileNode): Promise<string> {
    if (isDirectory(node)) {
      throw new InputException('Directories cannot be downloaded yet');
    }
    const id = isFile(node) ? node.latestVersionId : node.id;
    try {
      // before sending link, first check if object exists in s3
      await this.bucket.headObject(id);
      return await this.bucket.getSignedUrlForGetObject(id);
    } catch (e) {
      this.logger.error('Unable to generate download url', { exception: e });
      throw new ServerException('Unable to generate download url', e);
    }
  }

  async getParents(
    nodeId: string,
    session: ISession
  ): Promise<readonly FileNode[]> {
    const parents = await this.repo.getParentsById(nodeId, session);
    return await Promise.all(
      parents.map((node) => this.adaptBaseNodeToFileNode(node, session))
    );
  }

  async listChildren(
    parentId: string,
    input: FileListInput | undefined,
    session: ISession
  ): Promise<FileListOutput> {
    const result = await this.repo.getChildrenById(session, parentId, input);
    const items = (
      await Promise.all(
        result.children.map(async (node) => {
          try {
            return await this.adaptBaseNodeToFileNode(node, session);
          } catch (e) {
            if (e instanceof NotFoundException) {
              // If no active versions pretend the file doesn't exist.
              return [];
            }
            throw e;
          }
        })
      )
    ).flatMap((n) => n);
    return {
      items: items,
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  async createDirectory(
    parentId: string | undefined,
    name: string,
    session: ISession
  ): Promise<Directory> {
    if (parentId) {
      // Enforce parent exists and is a directory
      const parent = await this.getParentNode(parentId, session);
      if (!isDirectoryNode(parent)) {
        throw new InputException(
          'Directories can only be created under directories',
          'parentId'
        );
      }
      try {
        await this.repo.getBaseNodeByName(parentId, name, session);
        throw new DuplicateException(
          'name',
          'Node with this name already exists in this directory'
        );
      } catch (e) {
        if (!(e instanceof NotFoundException)) {
          throw e;
        }
      }
    }

    const id = await this.repo.createDirectory(parentId, name, session);

    return await this.getDirectory(id, session);
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
    const [tempUpload, existingUpload] = await Promise.allSettled([
      this.bucket.headObject(`temp/${uploadId}`),
      this.bucket.headObject(uploadId),
    ]);

    if (
      tempUpload.status === 'rejected' &&
      existingUpload.status === 'rejected'
    ) {
      if (
        (tempUpload.reason as AWSError).code === 'NotFound' ||
        tempUpload.reason instanceof NotFoundException
      ) {
        throw new NotFoundException('Could not find upload', 'uploadId');
      }
      throw new ServerException('Unable to create file version');
    } else if (
      tempUpload.status === 'fulfilled' &&
      existingUpload.status === 'fulfilled'
    ) {
      if (tempUpload.value && existingUpload.value) {
        throw new InputException(
          'Upload request has already been used',
          'uploadId'
        );
      }
      throw new ServerException('Unable to create file version');
    } else if (
      tempUpload.status === 'rejected' &&
      existingUpload.status === 'fulfilled'
    ) {
      const fileNode = await this.getFileNode(uploadId, session);

      if (fileNode) {
        throw new InputException('Already uploaded', 'uploadId');
      }
    }

    const parent = await this.getParentNode(parentId, session);
    if (isFileVersionNode(parent)) {
      throw new InputException(
        'Only files and directories can be parents of a file version',
        'parentId'
      );
    }

    const fileId = isFileNode(parent)
      ? parent.id
      : await this.getOrCreateFileByName(parent.id, name, session);
    this.logger.debug('Creating file version', {
      parentId: fileId,
      fileName: name,
      uploadId,
    });

    const upload =
      tempUpload.status === 'fulfilled'
        ? tempUpload.value
        : existingUpload.status === 'fulfilled'
        ? existingUpload.value
        : undefined;

    const mimeType = upload?.ContentType ?? 'application/octet-stream';
    const category = getCategoryFromMimeType(mimeType);
    await this.repo.createFileVersion(
      fileId,
      {
        id: uploadId,
        name,
        mimeType,
        size: upload?.ContentLength ?? 0,
        category,
      },
      session
    );

    // Skip S3 move if it's not needed
    if (existingUpload.status === 'rejected') {
      await this.bucket.moveObject(`temp/${uploadId}`, uploadId);
    }

    return await this.getFile(fileId, session);
  }

  private async getParentNode(id: string, session: ISession) {
    try {
      return await this.repo.getBaseNodeById(id, session);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new NotFoundException('Could not find parent');
      }
      throw e;
    }
  }

  private async getOrCreateFileByName(
    parentId: string,
    name: string,
    session: ISession
  ) {
    try {
      const node = await this.repo.getBaseNodeByName(parentId, name, session);
      this.logger.debug('Using existing file matching given name', {
        parentId,
        fileName: name,
        fileId: node.id,
      });
      return node.id;
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
    }

    const fileId = await this.repo.createFile(parentId, name, session);
    this.logger.debug(
      'File matching given name not found, creating a new one',
      {
        parentId,
        fileName: name,
        fileId: fileId,
      }
    );
    return fileId;
  }

  async createDefinedFile(
    name: string,
    session: ISession,
    initialVersion?: CreateDefinedFileVersionInput,
    field?: string
  ) {
    const fileId = await this.repo.createFile(undefined, name, session);
    if (initialVersion) {
      try {
        await this.createFileVersion(
          {
            parentId: fileId,
            uploadId: initialVersion.uploadId,
            name: initialVersion.name ?? name,
          },
          session
        );
      } catch (e) {
        if (e instanceof InputException && e.field === 'uploadId' && field) {
          throw e.withField(field + '.uploadId');
        }
        throw e;
      }
    }
    return fileId;
  }

  async updateDefinedFile(
    file: DefinedFile,
    field: string,
    input: CreateDefinedFileVersionInput | undefined,
    session: ISession
  ) {
    if (!input) {
      return;
    }
    if (!file.canRead || !file.canEdit || !file.value) {
      throw new UnauthorizedException(
        'You do not have permission to update this file',
        field
      );
    }
    const name = input.name ?? (await this.getFile(file.value, session)).name;
    try {
      await this.createFileVersion(
        {
          parentId: file.value,
          uploadId: input.uploadId,
          name,
        },
        session
      );
    } catch (e) {
      if (e instanceof InputException && e.field === 'uploadId' && field) {
        throw e.withField(field + '.uploadId');
      }
      throw e;
    }
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

  async rename(input: RenameFileInput, session: ISession): Promise<void> {
    const fileNode = await this.repo.getBaseNodeById(input.id, session);
    await this.repo.rename(fileNode, input.name, session);
  }

  async move(input: MoveFileInput, session: ISession): Promise<FileNode> {
    const fileNode = await this.repo.getBaseNodeById(input.id, session);

    if (input.name) {
      await this.repo.rename(fileNode, input.name, session);
    }

    await this.repo.move(input.id, input.parentId, session);

    return await this.getFileNode(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const fileNode = await this.repo.getBaseNodeById(id, session);
    await this.repo.delete(fileNode, session);
  }

  async checkConsistency(type: FileNodeType, session: ISession): Promise<void> {
    return await this.repo.checkConsistency(type, session);
  }
}
