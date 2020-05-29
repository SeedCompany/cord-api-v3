import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import type { AWSError } from 'aws-sdk';
import { isString } from 'lodash';
import { generate } from 'shortid';
import { ISession, NotImplementedError } from '../../common';
import { ILogger, Logger } from '../../core';
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
  isFileNode,
  isFileVersion,
  isFileVersionNode,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
  SecuredFile,
} from './dto';
import { FileRepository } from './file.repository';
import { FilesBucketToken } from './files-s3-bucket.factory';
import { getCategoryFromMimeType } from './mimeTypes';
import { IS3Bucket } from './s3-bucket';

@Injectable()
export class FileService {
  constructor(
    @Inject(FilesBucketToken) private readonly bucket: IS3Bucket,
    private readonly repo: FileRepository,
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

    const base = await this.repo.getBaseNodeById(id, session);

    if (base.type === FileNodeType.Directory) {
      return {
        ...base,
        type: FileNodeType.Directory,
        category: FileNodeCategory.Directory,
      };
    }

    const latestVersionId = await this.repo.getLatestVersionId(id);
    const version = await this.repo.getVersionDetails(latestVersionId, session);

    if (base.type === FileNodeType.FileVersion) {
      return version;
    }

    return {
      ...version,
      ...base,
      type: FileNodeType.File,
      latestVersionId,
      modifiedAt: version.createdAt,
      modifiedById: version.createdById,
    };
  }

  async getDownloadUrl(fileOrId: File | string): Promise<string> {
    const id = isString(fileOrId)
      ? await this.repo.getLatestVersionId(fileOrId)
      : fileOrId.latestVersionId;
    try {
      // before sending link, first check if object exists in s3
      await this.bucket.headObject(id);
      return await this.bucket.getSignedUrlForGetObject(id);
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
    _parentId: string,
    _input: FileListInput,
    _session: ISession
  ): Promise<FileListOutput> {
    throw new NotImplementedError();
  }

  async createDirectory(
    parentId: string | undefined,
    name: string,
    session: ISession
  ): Promise<Directory> {
    if (parentId) {
      // TODO Ensure name is unique
    }

    const id = await this.repo.createDirectory(parentId, name, session);

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
        (e as AWSError).code === 'NotFound' ||
        e instanceof NotFoundException
      ) {
        throw new NotFoundException('Could not find upload');
      }
      throw new ServerException('Unable to create file version');
    }

    let parent;
    try {
      parent = await this.repo.getBaseNodeById(parentId, session);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new NotFoundException('Could not find parent');
      }
      throw e;
    }

    if (isFileVersionNode(parent)) {
      throw new BadRequestException(
        'Only files and directories can be parents of a file version'
      );
    }

    const fileId = isFileNode(parent)
      ? parent.id
      : await this.getOrCreateFileByName(parent.id, name, session);

    const mimeType = upload.ContentType ?? 'application/octet-stream';
    const category = getCategoryFromMimeType(mimeType);
    await this.repo.createFileVersion(
      fileId,
      {
        id: uploadId,
        name,
        mimeType,
        size: upload.ContentLength ?? 0,
        category,
      },
      session
    );

    await this.bucket.moveObject(`temp/${uploadId}`, uploadId);

    return this.getFile(fileId, session);
  }

  private async getOrCreateFileByName(
    parentId: string,
    name: string,
    session: ISession
  ) {
    try {
      const node = await this.repo.getBaseNodeByName(parentId, name, session);
      return node.id;
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
    }

    return this.repo.createFile(parentId, name, session);
  }

  async createDefinedFile(
    name: string,
    session: ISession,
    initialVersion?: CreateDefinedFileVersionInput
  ) {
    const fileId = await this.repo.createFile(undefined, name, session);
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

    return this.getFileNode(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const fileNode = await this.repo.getBaseNodeById(id, session);
    await this.repo.delete(fileNode, session);
  }

  async checkFileConsistency(
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    return this.repo.checkFileConsistency(baseNode, session);
  }
}
