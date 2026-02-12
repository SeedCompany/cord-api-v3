import {
  GetObjectCommand as GetObject,
  PutObjectCommand as PutObject,
} from '@aws-sdk/client-s3';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { bufferFromStream, cleanJoin, type Nil } from '@seedcompany/common';
import { fileTypeFromBuffer } from 'file-type';
import { intersection } from 'lodash';
import { Duration } from 'luxon';
import mime from 'mime';
import { extname } from 'node:path';
import sanitizeFilename from 'sanitize-filename';
import { Readable } from 'stream';
import {
  CreationFailed,
  DuplicateException,
  type DurationIn,
  generateId,
  type ID,
  InputException,
  isIdLike,
  NotFoundException,
  type Secured,
  ServerException,
  UnauthorizedException,
  UrlUtil,
} from '~/common';
import { ConfigService, ILogger, type LinkTo, Logger } from '~/core';
import { TransactionHooks } from '~/core/database';
import { Hooks } from '~/core/hooks';
import { LiveQueryStore } from '~/core/live-query';
import { FileBucket } from './bucket';
import {
  type CreateDefinedFileVersion,
  type CreateFileVersion,
  type Directory,
  type Downloadable,
  type File,
  type FileId,
  type FileListInput,
  type FileListOutput,
  type FileNode,
  FileNodeType,
  type FileUploadRequested,
  FileVersion,
  isDirectory,
  isFile,
  isFileVersion,
  type MoveFile,
  type RenameFile,
} from './dto';
import { FileUrlController as FileUrl } from './file-url.controller';
import { type FileUrlArgs } from './file-url.resolver-util';
import { FileRepository } from './file.repository';
import { AfterFileUploadHook } from './hooks/after-file-upload.hook';
import { MediaService } from './media/media.service';

type FileWithNewVersion = File & { newVersion: FileVersion };

@Injectable()
export class FileService {
  constructor(
    private readonly bucket: FileBucket,
    private readonly repo: FileRepository,
    private readonly txHooks: TransactionHooks,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
    private readonly hooks: Hooks,
    private readonly liveQueryStore: LiveQueryStore,
    @Logger('file:service') private readonly logger: ILogger,
  ) {}

  async getDirectory(id: ID): Promise<Directory> {
    const node = await this.getFileNode(id);
    if (!isDirectory(node)) {
      throw new InputException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: ID): Promise<File> {
    const node = await this.getFileNode(id);
    if (!isFile(node)) {
      throw new InputException('Node is not a file');
    }
    return node;
  }

  async getFileVersion(id: ID): Promise<FileVersion> {
    const node = await this.getFileNode(id);
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

  async getFileNode(id: ID): Promise<FileNode> {
    return await this.repo.getById(id);
  }

  async getFileNodes(ids: readonly ID[]) {
    return await this.repo.getByIds(ids);
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
    // I think this is a safety check for our S3 mocks
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!data) {
      throw new NotFoundException('Could not find file contents');
    }

    return data;
  }

  async getUrl(node: FileNode, options: FileUrlArgs) {
    const id =
      options.kind === 'Permanent' && isFile(node)
        ? node.latestVersionId
        : node.id;

    const overrideName = options.name
      ? sanitizeFilename(options.name) || null
      : null;
    const ext =
      overrideName && !isDirectory(node)
        ? extname(node.name) || mime.getExtension(node.mimeType)
        : null;
    const name = overrideName ? cleanJoin('', [overrideName, ext]) : node.name;

    const url = UrlUtil.withAddedPath(
      this.config.hostUrl$.value,
      FileUrl.path,
      id,
      encodeURIComponent(name),
    );
    return url.toString() + (options.download ? '?download' : '');
  }

  async getDownloadUrl(node: FileNode, options?: FileUrlArgs): Promise<string> {
    if (isDirectory(node)) {
      throw new InputException('View directories via GraphQL API');
    }
    const id = isFile(node) ? node.latestVersionId : node.id;
    const disposition = options?.download ? 'attachment' : 'inline';
    const fileName =
      (options?.name ? sanitizeFilename(options.name) || null : null) ??
      node.name;
    try {
      // before sending link, first check if object exists in s3
      await this.bucket.headObject(id);
      return await this.bucket.getSignedUrl(GetObject, {
        Key: id,
        ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(
          fileName,
        )}"`,
        ResponseContentType: node.mimeType,
        ResponseCacheControl: this.determineCacheHeader(node),
        signing: {
          expiresIn: this.getCacheTtl(node)
            // buffer to ensure validity while cached is fresh
            .plus({ seconds: 10 }),
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

    const publicStr = node.public ? 'public' : 'private';
    const isVersion = isFileVersion(node);
    return cleanJoin(', ', [
      isVersion && 'immutable',
      publicStr,
      duration('max-age', this.getCacheTtl(node)),
    ]);
  }

  private getCacheTtl(node: FileNode) {
    const type = isFileVersion(node) ? 'version' : 'file';
    const visibility = node.public ? 'public' : 'private';
    return this.config.files.cacheTtl[type][visibility];
  }

  async getParents(nodeId: ID): Promise<readonly FileNode[]> {
    return await this.repo.getParentsById(nodeId);
  }

  async listChildren(
    parent: FileNode,
    input: FileListInput | undefined,
  ): Promise<FileListOutput> {
    return await this.repo.getChildrenById(parent, input);
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
  ): Promise<Directory> {
    if (parentId) {
      await this.validateParentNode(
        parentId,
        (type) => type === FileNodeType.Directory,
        'Directories can only be created under directories',
      );
      try {
        await this.repo.getByName(parentId, name);
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

    const id = await this.repo.createDirectory(parentId, name);

    parentId && this.liveQueryStore.invalidate(['Directory', parentId]);

    return await this.getDirectory(id);
  }

  async createRootDirectory(
    ...args: Parameters<FileRepository['createRootDirectory']>
  ) {
    return await this.repo.createRootDirectory(...args);
  }

  async requestUpload(): Promise<FileUploadRequested> {
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
    input: CreateFileVersion,
  ): Promise<FileWithNewVersion> {
    const {
      parent,
      file: uploadingFile,
      upload: uploadIdInput,
      mimeType: mimeTypeOverride,
      media,
    } = input;
    if (!uploadIdInput && !uploadingFile) {
      throw new InputException('Upload ID is required', 'upload');
    }

    const uploadId = uploadIdInput ?? (await generateId());

    const parentType = await this.validateParentNode(
      parent,
      (type) => type !== FileNodeType.FileVersion,
      'Only files and directories can be parents of a file version',
    );

    const name = await this.resolveName(undefined, input);

    if (uploadingFile) {
      const prevExists = uploadIdInput
        ? await this.bucket.headObject(uploadId).catch((e) => {
            if (e instanceof NotFoundException) {
              return false;
            }
            throw e;
          })
        : false;
      if (prevExists) {
        throw new InputException(
          'A file with this ID already exists. Request an new upload ID.',
        );
      }

      const body = await uploadingFile.arrayBuffer();

      let type: string | Nil = uploadingFile.type;
      type = type === 'application/octet-stream' ? null : type;
      type ??= (await fileTypeFromBuffer(body))?.mime;
      type ??= mime.getType(name);
      type ??= 'application/octet-stream';

      await this.bucket.putObject({
        Key: `temp/${uploadId}`,
        ContentType: type,
        Body: Buffer.from(body),
      });
    }

    const [tempUpload, existingUpload] = await Promise.allSettled([
      this.bucket.headObject(`temp/${uploadId}`),
      this.bucket.headObject(uploadId),
    ]);

    if (
      tempUpload.status === 'rejected' &&
      existingUpload.status === 'rejected'
    ) {
      if (tempUpload.reason instanceof NotFoundException) {
        throw new NotFoundException('Could not find upload', 'upload');
      }
      throw new CreationFailed(FileVersion);
    } else if (
      tempUpload.status === 'fulfilled' &&
      existingUpload.status === 'fulfilled'
    ) {
      throw new InputException(
        'Upload request has already been used',
        'upload',
      );
    } else if (
      tempUpload.status === 'rejected' &&
      existingUpload.status === 'fulfilled'
    ) {
      try {
        await this.getFileNode(uploadId);
        throw new InputException('Already uploaded', 'upload');
      } catch (e) {
        if (!(e instanceof NotFoundException)) {
          throw e;
        }
      }
    }

    const fileId =
      parentType === FileNodeType.File
        ? parent
        : await this.getOrCreateFileByName(parent, name);
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

    const fv = await this.repo.createFileVersion(fileId, {
      id: uploadId,
      name: name,
      mimeType,
      size: upload?.ContentLength ?? 0,
    });
    this.liveQueryStore.invalidate(['File', fileId]);

    // Skip S3 move if it's not needed
    if (existingUpload.status === 'rejected') {
      await this.bucket.moveObject(`temp/${uploadId}`, uploadId);

      // Undo the above operation by moving it back to temp folder.
      this.txHooks.afterRollback.add(async () => {
        await this.bucket
          .moveObject(uploadId, `temp/${uploadId}`)
          .catch((e) => {
            this.logger.error('Failed to move file back to temp holding', {
              uploadId,
              exception: e,
            });
          });
      });
    }

    await this.mediaService.detectAndSave(fv, media);

    // Change the file's name to match the latest version name
    await this.rename({ id: fileId, name });

    const file = await this.getFile(fileId);

    await this.hooks.run(new AfterFileUploadHook(file, fv));

    return { ...file, newVersion: fv };
  }

  private async validateParentNode(
    id: ID,
    isType: (type: FileNodeType) => boolean,
    typeMismatchError: string,
  ) {
    const node = await this.repo.getBaseNode(id);
    if (!node) {
      throw new NotFoundException('Could not find parent', 'parent');
    }
    const type = intersection(
      node.labels,
      Object.keys(FileNodeType),
    )[0] as FileNodeType;
    if (!isType(type)) {
      throw new InputException(typeMismatchError, 'parent');
    }
    return type;
  }

  private async resolveName(name?: string, input?: CreateDefinedFileVersion) {
    if (name) {
      return sanitizeFilename(name);
    }
    if (input?.name) {
      return sanitizeFilename(input.name);
    }
    if (input?.file) {
      const sanitized = sanitizeFilename(input.file.name);
      if (sanitized) {
        return sanitized;
      }
    }
    throw new InputException('File name is required', 'name');
  }

  private async getOrCreateFileByName(parentId: ID, name: string) {
    try {
      const node = await this.repo.getByName(parentId, name);
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
    await this.repo.createFile({ fileId, name, parentId });

    this.liveQueryStore.invalidate(['Directory', parentId]);

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
    baseNodeId: ID,
    propertyName: string,
    initialVersion?: CreateDefinedFileVersion,
    isPublic?: boolean,
  ) {
    const name = await this.resolveName(initialFileName, initialVersion);
    await this.repo.createFile({
      fileId,
      name,
      public: isPublic,
      propOfNode: [baseNodeId, propertyName + 'Node'],
    });

    if (initialVersion) {
      try {
        await this.createFileVersion({
          parent: fileId,
          ...initialVersion,
          name: initialVersion.name ?? name,
        });
      } catch (e) {
        if (e instanceof InputException && e.field === 'upload') {
          throw e.withField(propertyName + '.upload');
        }
        throw e;
      }
    }
  }

  async updateDefinedFile<Input extends CreateDefinedFileVersion | undefined>(
    file: Secured<FileId | LinkTo<'File'> | null>,
    field: string,
    input: Input,
  ): Promise<
    FileWithNewVersion | (Input extends NonNullable<Input> ? never : undefined)
  > {
    if (input == null) {
      // @ts-expect-error idk why TS doesn't like this, but the signature is right.
      return undefined;
    }
    if (!file.canRead || !file.canEdit || !file.value) {
      throw new UnauthorizedException(
        'You do not have permission to update this file',
        field,
      );
    }
    const fileId = isIdLike(file.value) ? file.value : file.value.id;
    try {
      return await this.createFileVersion({
        parent: fileId,
        ...input,
      });
    } catch (e) {
      if (e instanceof InputException && e.field === 'upload' && field) {
        throw e.withField(field + '.upload');
      }
      throw e;
    }
  }

  async rename(input: RenameFile): Promise<void> {
    const fileNode = await this.repo.getById(input.id);
    if (fileNode.name !== input.name) {
      await this.repo.rename(fileNode, input.name);
    }
  }

  async move(input: MoveFile): Promise<FileNode> {
    const fileNode = await this.repo.getById(input.id);

    if (input.name) {
      await this.repo.rename(fileNode, input.name);
    }

    const change = await this.repo.move(input.id, input.parent);
    for (const parent of [change.oldParent, change.newParent]) {
      this.liveQueryStore.invalidate([
        // Cheat to resolve typename since it's just these two.
        parent.labels.includes('Directory') ? 'Directory' : 'File',
        parent.properties.id,
      ]);
    }

    return await this.getFileNode(input.id);
  }

  async delete(id: ID): Promise<void> {
    const fileNode = await this.repo.getById(id);
    await this.repo.delete(fileNode);
  }
}
