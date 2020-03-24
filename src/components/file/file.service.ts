import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, NotImplementedError } from '../../common';
import { ILogger, Logger } from '../../core';
import { DatabaseService } from '../../core/database/database.service';
import { UserService } from '../user';
import {
  CreateFileInput,
  Directory,
  File,
  FileListInput,
  FileListOutput,
  FileNodeCategory,
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
    @Inject(FilesBucketToken) private readonly bucket: S3Bucket,
    private readonly db: DatabaseService,
    @Logger('language:service') private readonly logger: ILogger,
    private readonly userService: UserService
  ) {}
  // eslint-disable-next-line prettier/prettier

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
    this.logger.info(`Query readOne FileNode: id ${id} by ${session.userId}`);
    const user = await this.userService.readOne(session.userId!, session);
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
        }),
        (fv: FileVersion {id: $uploadId, active: true}),
        (fv)-[:parent {active: true}]->(parent:Property {active: true}),
        (fv)<-[:version {active: true}]-(file:FileNode)
        WITH * OPTIONAL MATCH (file)-[:type {active: true}]->(type:Property {active: true})
        WITH * OPTIONAL MATCH (file)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadSize: true})-[:toNode]->(fv)-[:size {active: true}]->(size:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadMimeType: true})-[:toNode]->(fv)-[:mimeType {active: true}]->(mimeType:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadCategory: true})-[:toNode]->(fv)-[:category {active: true}]->(category:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadModifiedAt: true})-[:toNode]->(fv)-[:modifiedAt {active: true}]->(modifiedAt:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadName: true})-[:toNode]->(fv)-[:name {active: true}]->(name:Property {active: true})
        RETURN
        size.value as size,
        mimeType.value as mimeType,
        category.value as category,
        modifiedAt.value as modifiedAt,
        parent.value as parent,
        file.createdAt as createdAt,
        fv.id as id,
        type.value as type,
        name.value as name
        `,
        {
          uploadId: id,
          requestingUserId: session.userId,
          token: session.token,
        }
      )
      .first();

    return {
      category: FileNodeCategory.Document, //TODO category should be derived based on the mimeType
      createdAt: result!.createdAt,
      createdBy: { ...user },
      id: result!.id,
      mimeType: result!.mimeType,
      modifiedAt: result!.modifiedAt,
      name: result!.name,
      parents: [], // TODO
      size: result!.size,
      type: result!.type,
    };
  }

  async getDownloadUrl(fileId: string, _session: ISession): Promise<string> {
    // before sending link, first check if object exists in s3,
    const obj = await this.bucket.getObject(fileId);
    if (!obj) {
      throw new BadRequestException('object not found');
    }

    return this.bucket.getSignedUrlForPutObject(fileId);
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

  async createDirectory(_name: string, _session: ISession): Promise<Directory> {
    throw new NotImplementedError();
  }

  async requestUpload(): Promise<RequestUploadOutput> {
    const id = generate();
    const url = await this.bucket.getSignedUrlForPutObject(`temp/${id}`);
    return { id, url };
  }

  async createFile(
    { parentId, uploadId, name }: CreateFileInput,
    session: ISession
  ): Promise<File> {
    try {
      const file = await this.bucket.getObject(`${uploadId}`);
      const fileId = generate();
      if (!file) {
        throw new BadRequestException('object not found');
      }
      await this.bucket.moveObject(`temp/${uploadId}`, `${uploadId}`);
      await this.db.createNode({
        session,
        type: File.classType,
        input: {
          id: fileId,
          mimeType: file.ContentType, // TODO Should be stored on file version
          name,
          parent: parentId, // TODO Should be a relationship
          size: file.ContentLength, // TODO Should be stored on file version
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
      });
      const inputForFileVersion = {
        category: FileNodeCategory.Document, // TODO
        id: uploadId,
        mimeType: file.ContentType,
        modifiedAt: DateTime.local(),
        name,
        parent: parentId, // TODO Should be a relationship; prop to file id
        size: file.ContentLength,
      };
      const acls = {
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
      };
      await this.db.createNode({
        session,
        type: FileVersion.classType,
        input: inputForFileVersion,
        acls,
      });
      const qry = `
        MATCH
          (file:FileNode {id: "${fileId}"})
        WITH * OPTIONAL MATCH (file)-[:parent {active: true}]->(prop:Property {active: true, value: "${parentId}"}),
          (fv:FileVersion {id: "${uploadId}"}),
          (user:User { id: "${session.userId}", active: true})
        CREATE
          (file)-[:version {active: true, createdAt: datetime()}]->(fv),
          (file)-[:createdBy {active: true, createdAt: datetime()}]->(user),
          (fv)-[:createdBy {active: true, createdAt: datetime()}]->(user)
        RETURN
          file, fv, user
      `;
      await this.db
        .query()
        .raw(qry, {
          fileId: fileId,
          name,
          parentId,
          userId: session.userId,
        })
        .run();

      return this.getFile(uploadId, session);
    } catch (e) {
      throw new Error(e);
    }
  }

  async updateFile(_input: UpdateFileInput, _session: ISession): Promise<File> {
    throw new NotImplementedError();
  }

  async rename(
    _input: RenameFileInput,
    _session: ISession
  ): Promise<FileOrDirectory> {
    throw new NotImplementedError();
  }

  async move(
    input: MoveFileInput,
    session: ISession
  ): Promise<FileOrDirectory> {
    // TODO findout options for name usage here
    const { id, parentId } = input;
    const file = await this.bucket.getObject(id);
    if (!file) {
      throw new BadRequestException('object not found');
    }
    await this.bucket.moveObject(`test/${id}`, `${parentId}/${id}`);
    return this.getFile(id, session);
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedError();
  }
}
