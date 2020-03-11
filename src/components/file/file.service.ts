import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import { NotImplementedError } from '../../common';
import { PropertyUpdaterService } from '../../core';
import { AuthService, ISession } from '../auth';
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
    private readonly db: Connection,
    @Inject(FilesBucketToken) private readonly bucket: S3Bucket,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly propertyUpdater: PropertyUpdaterService
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
        WITH * OPTIONAL MATCH (user:User {active: true, id: $id, owningOrgId: $owningOrgId})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:type {active: true}]->(type:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:size {active: true}]->(size:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:mimeType {active: true}]->(mimeType:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:category {active: true}]->(category:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl:ACL {canReadFile: true})-[:toNode]->(file)-[:name {active: true}]->(name:Property {active: true})
        RETURN
        file.id as id,
        file.createdAt as createdAt,
        file.category as category,
        name.value as name,
        type.value as type,
        size.value as size,
        mimeType.value as mimeType,
        requestingUser,
        user 
          `,
        {
          id,
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
        }
      )
      .first();
    console.log('result is', result);
    if (!result) {
      throw new NotFoundException('Could not find file');
    }
    console.log('result is', result);
    return {
      id: result.id,
      category: FileNodeCategory.Directory, //TODO category should be derived based on the mimeType
      createdAt: result.createdAt,
      createdBy: {
        id: result.requestingUser.id,
        createdAt: result.requestingUser.createdAt,
        email: {
          value: result.requestingUser.email,
          canRead: result.requestingUser.canReadEmail,
          canEdit: result.requestingUser.canEditEmail,
        },
        realFirstName: {
          value: result.requestingUser.realFirstName,
          canRead: result.requestingUser.canReadRealFirstName,
          canEdit: result.requestingUser.canEditRealFirstName,
        },
        realLastName: {
          value: result.requestingUser.realLastName,
          canRead: result.requestingUser.canReadRealLastName,
          canEdit: result.requestingUser.canEditRealLastName,
        },
        displayFirstName: {
          value: result.requestingUser.displayFirstName,
          canRead: result.requestingUser.canReadDisplayFirstName,
          canEdit: result.requestingUser.canEditDisplayFirstName,
        },
        displayLastName: {
          value: result.requestingUser.displayLastName,
          canRead: result.requestingUser.canReadDisplayLastName,
          canEdit: result.requestingUser.canEditDisplayLastName,
        },
        phone: {
          value: result.requestingUser.phone,
          canRead: result.requestingUser.canReadPhone,
          canEdit: result.requestingUser.canEditPhone,
        },
        timezone: {
          value: result.requestingUser.timezone,
          canRead: result.requestingUser.canReadTimezone,
          canEdit: result.requestingUser.canEditTimezone,
        },
        bio: {
          value: result.requestingUser.bio,
          canRead: result.requestingUser.canReadBio,
          canEdit: result.requestingUser.canEditBio,
        },
      },
      mimeType: result.mimeType,
      name: result.name,
      parents: result.parents,
      size: result.size,
      type: result.type,
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
      if (!file) {
        throw new BadRequestException('object not found');
      }
      //  await this.bucket.moveObject(`temp/${uploadId}`, `${uploadId}`);
      const acls = {
        canReadFile: true,
        canEditFile: true,
      };
      const input = {
        id: uploadId,
        parentId,
        name,
        type: FileNodeType.File,
        size: file.ContentLength,
        mimeType: file.ContentType,
      };
      await this.propertyUpdater.createNode({
        session,
        input: { ...input },
        acls,
        baseNodeLabel: 'FileNode',
        aclEditProp: 'canCreateFileNode',
      });

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
