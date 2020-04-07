import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, NotImplementedError } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
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

  async getDirectory(id: string, session: ISession): Promise<Directory> {
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
        (dir: Directory {id: $uploadId, active: true})
      WITH * OPTIONAL MATCH (dir)-[:type {active:true}]->(dirType:Property {active: true})
      WITH * OPTIONAL MATCH (dir)-[:name {active:true}]->(dirName:Property {active: true})
      RETURN
        dir.createdAt as createdAt,
        dir.id as id,
        dirType.value as type,
        dirName.value as name
      `,
        {
          uploadId: id,
          requestingUserId: session.userId,
          token: session.token,
        }
      )
      .first();

    return {
      createdAt: result!.createdAt,
      createdBy: { ...user },
      id: result!.id,
      type: result!.type,
      name: result!.name,
      category: FileNodeCategory.Document, // TODO
      parents: [], // TODO
    };
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
          (file: FileNode {id: $uploadId, active: true}),
          (file)-[:version {active: true}]->(fv:FileVersion {active: true})
        WITH * OPTIONAL MATCH (file)-[:type {active: true}]->(type:Property {active: true})
        WITH * OPTIONAL MATCH (file)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadSize: true})-[:toNode]->(fv)-[:size {active: true}]->(size:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadMimeType: true})-[:toNode]->(fv)-[:mimeType {active: true}]->(mimeType:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadCategory: true})-[:toNode]->(fv)-[:category {active: true}]->(category:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadModifiedAt: true})-[:toNode]->(fv)-[:modifiedAt {active: true}]->(modifiedAt:Property {active: true})
        RETURN
          size.value as size,
          mimeType.value as mimeType,
          category.value as category,
          modifiedAt.value as modifiedAt,
          file.createdAt as createdAt,
          file.id as id,
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

  async createDirectory(name: string, session: ISession): Promise<Directory> {
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
      baseNodeLabel: 'Directory',
      aclEditProp: 'canCreateDirectory',
    });
    // create createdby relationship
    const qry = `
      MATCH
        (dirNode:Directory {id: "${id}", active: true}),
        (user:User {id: "${session.userId}", active: true})
      CREATE
        (dirNode)-[:createdBy {active: true, createdAt: datetime()}]->(user)
      RETURN
        dirNode,user
    `;
    await this.db
      .query()
      .raw(qry, {
        id,
        userId: session.userId,
      })
      .run();

    return this.getDirectory(id, session);
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
    const file = await this.bucket.getObject(`temp/${uploadId}`);
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
      baseNodeLabel: 'FileNode',
      aclEditProp: 'canCreateFileNode',
    });
    const inputForFileVersion = {
      category: FileNodeCategory.Document, // TODO
      id: uploadId,
      mimeType: file.ContentType,
      modifiedAt: DateTime.local(),
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
    // create version relaitonship btw version and fileNode
    const qry = `
        MATCH
          (file:FileNode {id: "${fileId}"}),
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
    // create a parent relationship btw fileNode and parent(type is directory)
    const qryOne = `
        MATCH
          (file:FileNode {id: "${fileId}", active: true}),
          (parent:Directory { id: "${parentId}", active: true})
        CREATE
          (file)-[:parent {active: true}]->(parent)
        RETURN
          file, parent
      `;
    await this.db.query().raw(qryOne, { parentId }).first();

    return this.getFile(fileId, session);
  }

  async updateFile(input: UpdateFileInput, session: ISession): Promise<File> {
    const file = await this.bucket.getObject(`temp/${input.uploadId}`);
    if (!file) {
      throw new BadRequestException('object not found');
    }
    await this.bucket.moveObject(`temp/${input.uploadId}`, `${input.uploadId}`);
    const inputForFileVersion = {
      category: FileNodeCategory.Document, // TODO
      id: input.uploadId,
      mimeType: file.ContentType,
      modifiedAt: DateTime.local(),
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
        (file: FileNode {id: "${input.parentId}", active: true}),
        (newFv:FileVersion {id: "${input.uploadId}", active: true}),
        (user:User { id: "${session.userId}", active: true})
      CREATE
        (newFv)<-[:version {active: true, createdAt: datetime()}]-(file),
        (newFv)-[:modifiedBy {active: true, modifiedAt: datetime()}]->(user)
      RETURN
        file, newFv, user
    `;
    await this.db
      .query()
      .raw(qry, {
        fileId: input.parentId,
        userId: session.userId,
      })
      .first();

    return this.getFile(input.parentId, session);
  }

  async rename(
    input: RenameFileInput,
    session: ISession
  ): Promise<FileOrDirectory> {
    try {
      const fileNode = await this.getFileNode(input.id, session);
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
      throw e;
    }
  }

  async move(input: MoveFileInput, session: ISession): Promise<File> {
    if (input.name) {
      await this.rename({ id: input.id, name: input.name }, session);
    }
    try {
      const query = `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })<-[:token {active: true}]-
          (requestingUser:User {
            active: true,
            id: $requestingUserId,
            owningOrgId: $owningOrgId
          }),
          (newParent {id: $parentId, active: true}),
          (file:FileNode {id: $id, active: true})-[rel:parent {active: true}]->(oldParent {active : true})
        DELETE rel
        CREATE (newParent)<-[:parent {active: true, createdAt: datetime()}]-(file)
        RETURN  newParent
      `;

      await this.db
        .query()
        .raw(query, {
          id: input.id,
          owningOrgId: session.owningOrgId,
          parentId: input.parentId,
          requestingUserId: session.userId,
          token: session.token,
        })
        .first();
      return await this.getFile(input.id, session);
    } catch (e) {
      this.logger.error('Failed to move', { ...input, exception: e });
      throw e;
    }
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
      throw e;
    }
  }
}
