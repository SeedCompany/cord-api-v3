import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import {
  bufferFromStream,
  DuplicateException,
  generateId,
  ID,
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
  CreateDefinedFileVersionInput,
  CreateFileVersionInput,
  DefinedFile,
  Directory,
  Downloadable,
  File,
  FileListInput,
  FileListOutput,
  FileNode,
  FileNodeType,
  FileVersion,
  isDirectory,
  isFile,
  isFileVersion,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
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

  async getDirectory(id: ID, session: Session): Promise<Directory> {
    const node = await this.getFileNode(id, session);
    if (!isDirectory(node)) {
      throw new InputException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: ID, session: Session): Promise<File> {
    const node = await this.getFileNode(id, session);
    if (!isFile(node)) {
      throw new InputException('Node is not a file');
    }
    return node;
  }

  async getFileVersion(id: ID, session: Session): Promise<FileVersion> {
    const node = await this.getFileNode(id, session);
    if (!isFileVersion(node)) {
      throw new InputException('Node is not a file version');
    }
    return node;
  }

  asDownloadable<T>(obj: T, fileVersionId: ID): Downloadable<T>;
  asDownloadable(fileVersion: FileVersion): Downloadable<FileVersion>;
  asDownloadable<T>(obj: T, fileVersionId?: ID): Downloadable<T> {
    let downloading: Promise<Buffer> | undefined;
    return Object.assign(obj, {
      download: () => {
        if (!downloading) {
          downloading = this.downloadFileVersion(
            fileVersionId ?? (obj as unknown as FileVersion).id
          );
        }
        return downloading;
      },
    });
  }

  async getFileNode(id: ID, session: Session): Promise<FileNode> {
    this.logger.debug(`getNode`, { id, userId: session.userId });
    return await this.repo.getById(id, session);
  }

  async getFileNodes(ids: readonly ID[], session: Session) {
    this.logger.debug(`getNodes`, { ids, userId: session.userId });
    return await this.repo.getByIds(ids, session);
  }

  /**
   * Internal API method to download file contents from S3
   */
  async downloadFileVersion(versionId: ID): Promise<Buffer> {
    let data;
    try {
      const obj = await this.bucket.getObject(versionId);
      data = obj.Body;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      throw new ServerException('Failed to retrieve file contents', e);
    }
    if (!data) {
      throw new NotFoundException('Could not find file contents');
    }

    return await bufferFromStream(data);
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

  async getParents(nodeId: ID, session: Session): Promise<readonly FileNode[]> {
    return await this.repo.getParentsById(nodeId, session);
  }

  async listChildren(
    parent: FileNode,
    input: FileListInput | undefined,
    _session: Session
  ): Promise<FileListOutput> {
    return await this.repo.getChildrenById(parent, input);
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    session: Session
  ): Promise<Directory> {
    await this.authorizationService.checkPower(Powers.CreateDirectory, session);
    if (parentId) {
      await this.validateParentNode(
        parentId,
        (type) => type === FileNodeType.Directory,
        'Directories can only be created under directories'
      );
      try {
        await this.repo.getByName(parentId, name, session);
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
      if (tempUpload.reason instanceof NotFoundException) {
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

    const parentType = await this.validateParentNode(
      parentId,
      (type) => type !== FileNodeType.FileVersion,
      'Only files and directories can be parents of a file version'
    );

    const fileId =
      parentType === FileNodeType.File
        ? parentId
        : await this.getOrCreateFileByName(parentId, name, session);
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

    // Change the file's name to match the latest version name
    await this.rename({ id: fileId, name }, session);

    return await this.getFile(fileId, session);
  }

  private async validateParentNode(
    id: ID,
    isType: (type: FileNodeType) => boolean,
    typeMismatchError: string
  ) {
    const node = await this.repo.getBaseNode(id);
    if (!node) {
      throw new NotFoundException('Could not find parent', 'parentId');
    }
    const type = intersection(
      node.labels,
      Object.keys(FileNodeType)
    )[0] as FileNodeType;
    if (!isType(type)) {
      throw new InputException(typeMismatchError, 'parentId');
    }
    return type;
  }

  private async getOrCreateFileByName(
    parentId: ID,
    name: string,
    session: Session
  ) {
    try {
      const node = await this.repo.getByName(parentId, name, session);
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
    fileId: ID,
    name: string,
    session: Session,
    baseNodeId: ID,
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
    if (!input) {
      return;
    }
    // -- we technically check if they have the CreateFileVersion power, even though it's just an update, right?
    await this.authorizationService.checkPower(
      Powers.CreateFileVersion,
      session
    );
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
  }

  async rename(input: RenameFileInput, session: Session): Promise<void> {
    const fileNode = await this.repo.getById(input.id, session);
    if (fileNode.name !== input.name) {
      await this.repo.rename(fileNode, input.name);
    }
  }

  async move(input: MoveFileInput, session: Session): Promise<FileNode> {
    const fileNode = await this.repo.getById(input.id, session);

    if (input.name) {
      await this.repo.rename(fileNode, input.name);
    }

    await this.repo.move(input.id, input.parentId, session);

    return await this.getFileNode(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const fileNode = await this.repo.getById(id, session);
    await this.repo.delete(fileNode, session);
  }
}
