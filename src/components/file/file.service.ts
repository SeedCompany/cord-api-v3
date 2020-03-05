import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import { NotImplementedError } from '../../common';
import { ISession, AuthService } from '../auth';
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
import { UserService, User } from '../user';
import { DateTime } from 'luxon';
import { PropertyUpdaterService } from '../../core';
import { Dictionary } from 'lodash';

@Injectable()
export class FileService {
  constructor(
    private readonly db: Connection,
    @Inject(FilesBucketToken) private readonly bucket: S3Bucket,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly propertyUpdater: PropertyUpdaterService,
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
      const result = await this.db
        .query()
        .raw(
          `
        MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        })
        WITH * OPTIONAL MATCH (file: FileNode { id: $id})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:type {active: true}]->(type:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:size {active: true}]->(size:Property {active: true})
        RETURN
        file.id as id,
        file.createdAt as createdAt,
        type.value as type,
        size.value as size
          `,
          {
            id,
            token: session.token,
            requestingUserId: session.userId,
            owningOrgId: session.owningOrgId,
          },
        )
        .first();
      if (!result) {
        throw new NotFoundException('Could not find file');
      }
      return {
        id: result.id,
        createdAt: result.createdAt,
        type: result.type,
        size: result.size,
      } as File;
  }

  async getDownloadUrl(fileId: string, session: ISession): Promise<string> {
    // before sending link, first check if object exists in s3,
    const obj = await this.bucket.getObject(fileId);
    if (!obj) {
      throw new BadRequestException('object not found');
    }

    return this.bucket.getSignedUrlForPutObject(fileId);
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
    try {
      // TODO find a better way to check if object exists in s3 and move
      const acls = {
        canReadFile: true,
        canEditFile: true,
      };
      const input = {
        id: uploadId,
        parentId,
        name,
        type: FileNodeType.File,
      };

      await this.propertyUpdater.createNode({
        session,
        input: {...input},
        acls,
        baseNodeLabel: 'FileNode',
        aclEditProp: 'canCreateFileNode',
      });

      return this.getFile(uploadId, session);
    } catch (e) {
      throw new Error(e);
    }
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
