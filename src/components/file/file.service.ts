import { forwardRef, Inject, Injectable } from '@nestjs/common';
import type { AWSError } from 'aws-sdk';
import { Readable } from 'stream';
import {
  DuplicateException,
  generateId,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ILogger, Logger } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
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

@Injectable()
export class FileService {
  constructor(
    @Inject(FilesBucketToken) private readonly bucket: FileBucket,
    private readonly repo: FileRepository,
    @Logger('file:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  async getDirectory(id: string, session: Session): Promise<Directory> {
    const node = await this.getFileNode(id, session);
    if (!isDirectory(node)) {
      throw new InputException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: string, session: Session): Promise<File> {
    const node = await this.getFileNode(id, session);
    if (!isFile(node)) {
      throw new InputException('Node is not a file');
    }
    return node;
  }

  async getFileVersion(id: string, session: Session): Promise<FileVersion> {
    const node = await this.getFileNode(id, session);
    if (!isFileVersion(node)) {
      throw new InputException('Node is not a file version');
    }
    return node;
  }

  async getFileNode(id: string, session: Session): Promise<FileNode> {
    this.logger.debug(`getNode`, { id, userId: session.userId });
    const base = await this.repo.getBaseNodeById(id, session);
    return await this.adaptBaseNodeToFileNode(base, session);
  }

  private async adaptBaseNodeToFileNode(
    node: BaseNode,
    session: Session
  ): Promise<FileNode> {
    if (node.type === FileNodeType.Directory) {
      return {
        ...node,
        type: FileNodeType.Directory,
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

  /**
   * Internal API method to download file contents from S3
   */
  async downloadFileVersion(versionId: string): Promise<Buffer> {
    let data;
    try {
      const obj = await this.bucket.getObject(versionId);
      data = obj.Body;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      if ((e as AWSError).code === 'NotFound') {
        throw new NotFoundException('Could not find file contents', e);
      }
      throw new ServerException('Failed to retrieve file contents', e);
    }
    if (!data) {
      throw new NotFoundException('Could not find file contents');
    }

    if (Buffer.isBuffer(data)) {
      return data;
    } else if (data instanceof Uint8Array || typeof data === 'string') {
      return Buffer.from(data);
    } else if (data instanceof Readable) {
      const chunks = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } else if (data instanceof Blob) {
      return Buffer.from(await data.text());
    } else {
      // Shouldn't be hit. S3 types scuffed the Blob type which is why the instanceof above is necessary
      throw new ServerException("Could not parse S3 object's body");
    }
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
    session: Session
  ): Promise<readonly FileNode[]> {
    const parents = await this.repo.getParentsById(nodeId, session);
    return await Promise.all(
      parents.map((node) => this.adaptBaseNodeToFileNode(node, session))
    );
  }

  async listChildren(
    parentId: string,
    input: FileListInput | undefined,
    session: Session
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
    session: Session
  ): Promise<Directory> {
    await this.authorizationService.checkPower(Powers.CreateDirectory, session);
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
    const id = await generateId();
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
    {
      parentId,
      uploadId,
      name,
      mimeType: mimeTypeOverride,
    }: CreateFileVersionInput,
    session: Session
  ): Promise<File> {
    await this.authorizationService.checkPower(
      Powers.CreateFileVersion,
      session
    );
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
      try {
        await this.getFileNode(uploadId, session);
        throw new InputException('Already uploaded', 'uploadId');
      } catch (e) {
        if (!(e instanceof NotFoundException)) {
          throw e;
        }
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

    const mimeType =
      mimeTypeOverride ?? upload?.ContentType ?? 'application/octet-stream';

    await this.repo.createFileVersion(
      fileId,
      {
        id: uploadId,
        name: name,
        mimeType,
        size: upload?.ContentLength ?? 0,
      },
      session
    );

    // Skip S3 move if it's not needed
    if (existingUpload.status === 'rejected') {
      await this.bucket.moveObject(`temp/${uploadId}`, uploadId);
    }

    return await this.getFile(fileId, session);
  }

  private async getParentNode(id: string, session: Session) {
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
    session: Session
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

    await this.authorizationService.checkPower(Powers.CreateFile, session);
    const fileId = await generateId();
    await this.repo.createFile(fileId, name, session, parentId);

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
    fileId: string,
    name: string,
    session: Session,
    baseNodeId: string,
    propertyName: string,
    initialVersion?: CreateDefinedFileVersionInput,
    field?: string
  ) {
    // not sure about this, but I'm thinking it's best to check from the get-go whether the user can create a file
    // File AND fileVersion
    await this.authorizationService.checkPower(Powers.CreateFile, session);
    await this.authorizationService.checkPower(
      Powers.CreateFileVersion,
      session
    );
    await this.repo.createFile(fileId, name, session);

    await this.repo.attachBaseNode(fileId, baseNodeId, propertyName + 'Node');

    if (initialVersion) {
      try {
        await this.createFileVersion(
          {
            parentId: fileId,
            uploadId: initialVersion.uploadId,
            name: initialVersion.name ?? name,
            mimeType: initialVersion.mimeType,
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
  }

  async updateDefinedFile(
    file: DefinedFile,
    field: string,
    input: CreateDefinedFileVersionInput | undefined,
    session: Session
  ) {
    // -- we technically check if they have the CreateFileVersion power, even though it's just an update, right?
    await this.authorizationService.checkPower(
      Powers.CreateFileVersion,
      session
    );
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
          mimeType: input.mimeType,
        },
        session
      );
    } catch (e) {
      if (e instanceof InputException && e.field === 'uploadId' && field) {
        throw e.withField(field + '.uploadId');
      }
      throw e;
    }

    // Change the file's name to match the latest version name
    // Since defined files are explicitly referenced by a named property
    // a consistent name is not required and automatically updating it is more
    // convenient for consumption.
    await this.rename({ id: file.value, name }, session);
  }

  async resolveDefinedFile(
    input: DefinedFile,
    session: Session
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

  async rename(input: RenameFileInput, session: Session): Promise<void> {
    const fileNode = await this.repo.getBaseNodeById(input.id, session);
    await this.repo.rename(fileNode, input.name);
  }

  async move(input: MoveFileInput, session: Session): Promise<FileNode> {
    const fileNode = await this.repo.getBaseNodeById(input.id, session);

    if (input.name) {
      await this.repo.rename(fileNode, input.name);
    }

    await this.repo.move(input.id, input.parentId, session);

    return await this.getFileNode(input.id, session);
  }

  async delete(id: string, session: Session): Promise<void> {
    const fileNode = await this.repo.getBaseNodeById(id, session);
    await this.repo.delete(fileNode, session);
  }

  async checkConsistency(type: FileNodeType, session: Session): Promise<void> {
    await this.repo.checkConsistency(type, session);
  }
}
