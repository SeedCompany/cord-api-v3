import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import { NotImplementedError } from '../../common';
import { ISession } from '../auth';
import {
  CreateFileInput,
  Directory,
  File,
  FileListInput,
  FileListOutput,
  FileNodeType,
  FileOrDirectory,
  FileVersion,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
  UpdateFileInput,
} from './dto';
import { FilesBucketToken } from './files-s3-bucket.factory';
import { S3Bucket } from './s3-bucket';

@Injectable()
export class FileService {
  constructor(
    private readonly db: Connection,
    @Inject(FilesBucketToken) private readonly bucket: S3Bucket,
  ) {}

  async getDirectory(id: string, session: ISession): Promise<Directory> {
    const node = await this.getFileNode(id, session);
    if (node.type !== FileNodeType.Directory) {
      throw new BadRequestException('Node is not a directory');
    }
    return node;
  }

  async getFile(id: string, session: ISession): Promise<File> {
    const node = await this.getFileNode(id, session);
    if (node.type !== FileNodeType.File) {
      throw new BadRequestException('Node is not a file');
    }
    return node;
  }

  async getFileNode(id: string, session: ISession): Promise<FileOrDirectory> {
    throw new NotImplementedError();
  }

  async getDownloadUrl(fileId: string, session: ISession): Promise<string> {
    throw new NotImplementedError();
  }

  async listChildren(
    input: FileListInput,
    session: ISession,
  ): Promise<FileListOutput> {
    throw new NotImplementedError();
  }

  async getVersions(fileId: string, session: ISession): Promise<FileVersion[]> {
    throw new NotImplementedError();
  }

  async createDirectory(name: string, session: ISession): Promise<Directory> {
    throw new NotImplementedError();
  }

  async requestUpload(): Promise<RequestUploadOutput> {
    const id = generate();
    const url = await this.bucket.getSignedUrlForPutObject(`temp/${id}`);
    return { id, url };
  }

  async createFile(
    { parentId, uploadId, name }: CreateFileInput,
    session: ISession,
  ): Promise<File> {
    await this.bucket.moveObject(`temp/${uploadId}`, `${parentId}/${uploadId}`);
    const result = await this.db
      .query()
      .raw(
        `
        MATCH (token:Token {active: true, value: $token})
        CREATE
            (file:FileNode { id: $id, type: $type, name: $name })
        RETURN
           file
          `,
        {
          id: uploadId,
          token: session.token,
          type: FileNodeType.File,
          name,
        },
      )
      .first();

    if (!result) {
      throw new Error('Could not create file');
    }

    return result.file.properties;
  }

  async updateFile(
    { parentId, uploadId }: UpdateFileInput,
    session: ISession,
  ): Promise<File> {
    throw new NotImplementedError();
  }

  async rename(
    { id, name }: RenameFileInput,
    session: ISession,
  ): Promise<FileOrDirectory> {
    throw new NotImplementedError();
  }

  async move(
    { id, parentId, name }: MoveFileInput,
    session: ISession,
  ): Promise<FileOrDirectory> {
    throw new NotImplementedError();
  }

  async delete(id: string, session: ISession): Promise<void> {
    throw new NotImplementedError();
  }
}
