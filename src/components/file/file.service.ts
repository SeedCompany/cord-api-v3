import {
  GetObjectCommand as GetObject,
  PutObjectCommand as PutObject,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { bufferFromStream, cleanJoin } from '@seedcompany/common';
import { Connection } from 'cypher-query-builder';
import { fileTypeFromStream } from 'file-type';
import { intersection } from 'lodash';
import { Duration } from 'luxon';
import sanitizeFilename from 'sanitize-filename';
import { Readable } from 'stream';
import {
  DuplicateException,
  DurationIn,
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '~/common';
import { withAddedPath } from '~/common/url.util';
import { ConfigService, IEventBus, ILogger, Logger } from '~/core';
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
import { AfterFileUploadEvent } from './events/after-file-upload.event';
import { FileUrlController as FileUrl } from './file-url.controller';
import { FileRepository } from './file.repository';
import { MediaService } from './media/media.service';

type FileWithNewVersion = File & { newVersion: FileVersion };

@Injectable()
export class FileService {
  constructor(
    private readonly bucket: FileBucket,
    private readonly repo: FileRepository,
    private readonly db: Connection,
    private readonly config: ConfigService,
    private readonly mediaService: MediaService,
    private readonly eventBus: IEventBus,
    @Logger('file:service') private readonly logger: ILogger,
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

  asDownloadable<T extends object>(obj: T, fileVersionId: ID): Downloadable<T>;
  asDownloadable(fileVersion: FileVersion): Downloadable<FileVersion>;
  asDownloadable<T extends object>(
    obj: T,
    fileVersionId?: ID,
  ): Downloadable<T> {
    const id = fileVersionId ?? (obj as unknown as FileVersion).id;

    let downloading: Promise<Buffer> | undefined;
    return Object.assign(obj, {
      download: () =>
        (downloading ??= this.downloadFileVersion(id).then(bufferFromStream)),
      stream: async () => {
        if (downloading) {
          // If already buffering file, just use that instead of going to source.
          return Readable.from(await downloading);
        }
        return await this.downloadFileVersion(id);
      },
    });
  }

  async getFileNode(id: ID, session?: Session): Promise<FileNode> {
    this.logger.debug(`getNode`, { id, userId: session?.userId });
    return await this.repo.getById(id, session);
  }

  async getFileNodes(ids: readonly ID[], session: Session) {
    this.logger.debug(`getNodes`, { ids, userId: session.userId });
    return await this.repo.getByIds(ids, session);
  }

  /**
   * Internal API method to download file contents from S3
   */
  private async downloadFileVersion(versionId: ID): Promise<Readable> {
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

    return data;
  }

  async getUrl(node: FileNode) {
    const url = withAddedPath(
      this.config.hostUrl,
      FileUrl.path,
      isFile(node) ? node.latestVersionId : node.id,
      encodeURIComponent(node.name),
    );
    return url.toString();
  }

  async getDownloadUrl(node: FileNode): Promise<string> {
    if (isDirectory(node)) {
      throw new InputException('View directories via GraphQL API');
    }
    const id = isFile(node) ? node.latestVersionId : node.id;
    try {
      // before sending link, first check if object exists in s3
      await this.bucket.headObject(id);
      return await this.bucket.getSignedUrl(GetObject, {
        Key: id,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
          node.name,
        )}"`,
        ResponseContentType: node.mimeType,
        ResponseCacheControl: this.determineCacheHeader(node),
        signing: {
          expiresIn: this.config.files.cacheTtl.version[
            node.public ? 'public' : 'private'
          ].plus({ seconds: 10 }), // buffer to ensure validity while cached is fresh
        },
      });
    } catch (e) {
      this.logger.error('Unable to generate download url', { exception: e });
      throw new ServerException('Unable to generate download url', e);
    }
  }

  determineCacheHeader(node: FileNode) {
    const duration = (name: string, d: DurationIn) =>
      `${name}=${Duration.from(d).as('seconds')}`;

    const { cacheTtl } = this.config.files;
    const publicStr = node.public ? 'public' : 'private';
    const isVersion = isFileVersion(node);
    return cleanJoin(', ', [
      isVersion && 'immutable',
      publicStr,
      duration('max-age', cacheTtl[isVersion ? 'version' : 'file'][publicStr]),
    ]);
  }

  async getParents(nodeId: ID, session: Session): Promise<readonly FileNode[]> {
    return await this.repo.getParentsById(nodeId, session);
  }

  async listChildren(
    parent: FileNode,
    input: FileListInput | undefined,
    _session: Session,
  ): Promise<FileListOutput> {
    return await this.repo.getChildrenById(parent, input);
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    session: Session,
  ): Promise<Directory> {
    if (parentId) {
      await this.validateParentNode(
        parentId,
        (type) => type === FileNodeType.Directory,
        'Directories can only be created under directories',
      );
      try {
        await this.repo.getByName(parentId, name, session);
        throw new DuplicateException(
          'name',
          'Node with this name already exists in this directory',
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

  async createRootDirectory(
    ...args: Parameters<FileRepository['createRootDirectory']>
  ) {
    return await this.repo.createRootDirectory(...args);
  }

  async requestUpload(): Promise<RequestUploadOutput> {
    const id = await generateId();
    const url = await this.bucket.getSignedUrl(PutObject, {
      Key: `temp/${id}`,
      signing: {
        expiresIn: this.config.files.putTtl,
      },
    });
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
    input: CreateFileVersionInput,
    session: Session,
  ): Promise<FileWithNewVersion> {
    const {
      parentId,
      file: uploadingFile,
      uploadId,
      mimeType: mimeTypeOverride,
      media,
    } = input;

    const parentType = await this.validateParentNode(
      parentId,
      (type) => type !== FileNodeType.FileVersion,
      'Only files and directories can be parents of a file version',
    );

    if (uploadingFile) {
      const prevExists = await this.bucket.headObject(uploadId).catch((e) => {
        if (e instanceof NotFoundException) {
          return false;
        }
        throw e;
      });
      if (prevExists) {
        throw new InputException(
          'A file with this ID already exists. Request an new upload ID.',
        );
      }
      const file = await uploadingFile;
      const type = await fileTypeFromStream(file.createReadStream());
      await this.bucket.putObject({
        Key: `temp/${uploadId}`,
        ContentType: type?.mime ?? file.mimetype,
        ContentEncoding: file.encoding,
        Body: file.createReadStream(),
      });
    }
    const name = await this.resolveName(undefined, input);

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
          'uploadId',
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

    const fv = await this.repo.createFileVersion(
      fileId,
      {
        id: uploadId,
        name: name,
        mimeType,
        size: upload?.ContentLength ?? 0,
      },
      session,
    );

    // Skip S3 move if it's not needed
    if (existingUpload.status === 'rejected') {
      await this.bucket.moveObject(`temp/${uploadId}`, uploadId);

      // A bit of a hacky way to move files back to the temp/ folder on
      // mutation error / transaction rollback. This prevents orphaned files in bucket.
      const tx = this.db.currentTransaction;
      // The mutation can be retried multiple times, when neo4j deems the error
      // is retry-able, but we only want to attach this rollback logic once.
      if (tx && !(tx as any).__S3_ROLLBACK) {
        (tx as any).__S3_ROLLBACK = true;

        const orig = tx.rollback.bind(tx);
        tx.rollback = async () => {
          // Undo above operation by moving it back to temp folder.
          await this.bucket
            .moveObject(uploadId, `temp/${uploadId}`)
            .catch((e) => {
              this.logger.error('Failed to move file back to temp holding', {
                uploadId,
                exception: e,
              });
            });
          await orig();
        };
      }
    }

    await this.mediaService.detectAndSave(fv, media);

    // Change the file's name to match the latest version name
    await this.rename({ id: fileId, name }, session);

    const file = await this.getFile(fileId, session);

    await this.eventBus.publish(new AfterFileUploadEvent(file, fv));

    return { ...file, newVersion: fv };
  }

  private async validateParentNode(
    id: ID,
    isType: (type: FileNodeType) => boolean,
    typeMismatchError: string,
  ) {
    const node = await this.repo.getBaseNode(id);
    if (!node) {
      throw new NotFoundException('Could not find parent', 'parentId');
    }
    const type = intersection(
      node.labels,
      Object.keys(FileNodeType),
    )[0] as FileNodeType;
    if (!isType(type)) {
      throw new InputException(typeMismatchError, 'parentId');
    }
    return type;
  }

  private async resolveName(
    name?: string,
    input?: CreateDefinedFileVersionInput,
  ) {
    if (name) {
      return sanitizeFilename(name);
    }
    if (input?.name) {
      return sanitizeFilename(input.name);
    }
    if (input?.file) {
      const file = await input.file;
      const sanitized = sanitizeFilename(file.filename);
      if (sanitized) {
        return sanitized;
      }
    }
    throw new InputException('File name is required', 'name');
  }

  private async getOrCreateFileByName(
    parentId: ID,
    name: string,
    session: Session,
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

    const fileId = await generateId();
    await this.repo.createFile({ fileId, name, session, parentId });

    this.logger.debug(
      'File matching given name not found, creating a new one',
      {
        parentId,
        fileName: name,
        fileId: fileId,
      },
    );
    return fileId;
  }

  async createDefinedFile(
    fileId: ID,
    initialFileName: string | undefined,
    session: Session,
    baseNodeId: ID,
    propertyName: string,
    initialVersion?: CreateDefinedFileVersionInput,
    field?: string,
    isPublic?: boolean,
  ) {
    const name = await this.resolveName(initialFileName, initialVersion);
    await this.repo.createFile({
      fileId,
      name,
      session,
      public: isPublic,
      propOfNode: [baseNodeId, propertyName + 'Node'],
    });

    if (initialVersion) {
      try {
        await this.createFileVersion(
          {
            parentId: fileId,
            ...initialVersion,
            name: initialVersion.name ?? name,
          },
          session,
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
    session: Session,
  ) {
    if (!input) {
      return;
    }
    if (!file.canRead || !file.canEdit || !file.value) {
      throw new UnauthorizedException(
        'You do not have permission to update this file',
        field,
      );
    }
    try {
      await this.createFileVersion(
        {
          parentId: file.value,
          ...input,
        },
        session,
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
