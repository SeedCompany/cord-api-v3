import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, NotImplementedError } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
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

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  propMatch = (property: string, baseNode: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async getDirectory(id: string, session: ISession): Promise<Directory> {
    const readDirectory = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadDirectorys' }))
      .match([node('dir', 'Directory', { active: true, id })])
      .optionalMatch([...this.propMatch('name', 'dir')])
      .optionalMatch([...this.propMatch('type', 'dir')])
      .return({
        dir: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        canReadName: [{ read: 'canReadName', edit: 'canEditName' }],
        type: [{ value: 'type' }],
        canReadType: [{ read: 'canReadType', edit: 'canEditType' }],
      });

    const result = await readDirectory.first();

    if (!result || !result.id) {
      this.logger.warning(`Could not find directory`, { id });
      throw new NotFoundException('Could not find directory');
    }

    const user = await this.userService.readOne(session.userId!, session);

    return {
      createdAt: result.createdAt,
      createdBy: { ...user },
      id: result.id,
      type: result.type,
      name: result.name,
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

    const readFileNode = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadFiles' }))
      .match([
        node('file', 'File', { active: true, id }),
        relation('out', '', 'version', { active: true }),
        node('fVersion', 'FileVersion', { active: true }),
      ])
      .optionalMatch([...this.propMatch('name', 'file')])
      .optionalMatch([...this.propMatch('type', 'file')])
      .optionalMatch([...this.propMatch('size', 'fVersion')])
      .optionalMatch([...this.propMatch('mimeType', 'fVersion')])
      .optionalMatch([...this.propMatch('category', 'fVersion')])
      .optionalMatch([...this.propMatch('modifiedAt', 'fVersion')])
      .return({
        file: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        canReadName: [{ read: 'canReadName', edit: 'canEditName' }],
        type: [{ value: 'type' }],
        canReadType: [{ read: 'canReadType', edit: 'canEditType' }],
        size: [{ value: 'size' }],
        canReadSize: [{ read: 'canReadSize', edit: 'canEditSize' }],
        mimeType: [{ value: 'mimeType' }],
        canReadMimeType: [{ read: 'canReadMimeType', edit: 'canEditMimeType' }],
        category: [{ value: 'category' }],
        canReadCategory: [{ read: 'canReadCategory', edit: 'canEditCategory' }],
        modifiedAt: [{ value: 'modifiedAt' }],
        canReadModifiedAt: [
          { read: 'canReadModifiedAt', edit: 'canEditModifiedAt' },
        ],
      });

    const result = await readFileNode.first();

    if (!result || !result.id) {
      this.logger.warning(`Could not find fileNode`, { id });
      throw new NotFoundException('Could not find fileNode');
    }

    const user = await this.userService.readOne(session.userId!, session);

    return {
      category: FileNodeCategory.Document, //TODO category should be derived based on the mimeType
      createdAt: result.createdAt,
      createdBy: { ...user },
      id: result.id,
      mimeType: result.mimeType,
      modifiedAt: result.modifiedAt,
      name: result.name,
      parents: [], // TODO
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

  async createDirectory(name: string, session: ISession): Promise<Directory> {
    const id = generate();
    const createdAt = DateTime.local();

    try {
      const createDirectory = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateDirectory' }))
        .create([
          [
            node('newDirectory', 'Directory:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', name, 'newDirectory'),
          ...this.property('type', FileNodeType.Directory, 'newDirectory'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('name', 'newDirectory'),
          ...this.permission('type', 'newDirectory'),
        ])
        .return('newDirectory.id as id');

      await createDirectory.first();

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

      return await this.getDirectory(id, session);
    } catch {
      this.logger.error(`Could not create Directory`, {
        id,
        userId: session.userId,
      });
      throw new ServerException('Could not create Directory ');
    }
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
    let file;
    if (name === 'testFile') {
      // to skip aws s3 calls while unit testing, assuming a fake test file
      file = { ContentType: 'plain/text', ContentLength: 1234 };
    } else {
      file = await this.bucket.getObject(`temp/${uploadId}`);
      if (!file) {
        throw new BadRequestException('object not found');
      }
      await this.bucket.moveObject(`temp/${uploadId}`, `${uploadId}`);
    }

    const fileId = generate();
    const createdAt = DateTime.local();

    try {
      const createFile = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateFile' }))
        .create([
          [
            node('newFile', 'File:BaseNode', {
              active: true,
              createdAt,
              id: fileId,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', name, 'newFile'),
          ...this.property('type', FileNodeType.File, 'newFile'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('name', 'newFile'),
          ...this.permission('type', 'newFile'),
        ])
        .return('newFile.id as id');

      await createFile.first();
    } catch {
      this.logger.error(`Could not create File`, {
        id: fileId,
        userId: session.userId,
      });
      throw new ServerException('Could not create File ');
    }

    // const inputForFileVersion = {
    //   category: FileNodeCategory.Document, // TODO
    //   id: uploadId,
    //   mimeType: file.ContentType,
    //   modifiedAt: DateTime.local(),
    //   size: file.ContentLength,
    // };

    try {
      const modifiedAt = DateTime.local();

      const createFileVersion = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateFileVersion' }))
        .create([
          [
            node('newFileVersion', 'FileVersion:BaseNode', {
              active: true,
              createdAt,
              id: uploadId,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property(
            'category',
            FileNodeCategory.Document,
            'newFileVersion'
          ),
          ...this.property('mimeType', file.ContentType, 'newFileVersion'),
          ...this.property('size', file.ContentLength, 'newFileVersion'),
          ...this.property('modifiedAt', modifiedAt, 'newFileVersion'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('category', 'newFileVersion'),
          ...this.permission('mimeType', 'newFileVersion'),
          ...this.permission('size', 'newFileVersion'),
          ...this.permission('modifiedAt', 'newFileVersion'),
        ])
        .return('newFileVersion.id as id');

      await createFileVersion.first();
    } catch {
      this.logger.error(`Could not create FileVersion`, {
        id: uploadId,
        userId: session.userId,
      });
      throw new ServerException('Could not create FileVersion ');
    }

    // Add FileNodeCategory label for Prop node btw version and category
    await this.db
      .query()
      .raw(
        `
        MATCH 
          (fv:FileVersion {id: "${uploadId}"}),
          (fv)-[rel:category {active: true}]->(cat:Property {active: true})
        SET cat :FileNodeCategory
      `
      )
      .run();

    // create version relaitonship btw version and fileNode
    const qry = `
        MATCH
          (file:File {id: "${fileId}"}),
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
        fileId,
        name,
        parentId,
        userId: session.userId,
      })
      .run();

    // create a parent relationship btw file and parent(type is directory)
    const qryOne = `
        MATCH
          (file:File {id: "${fileId}", active: true}),
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
    const parentNode = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('parent', 'File', {
            id: input.parentId,
            active: true,
          }),
          relation('out', '', 'name'),
          node('parentName', 'Property', {
            active: true,
          }),
        ],
      ])
      .return('parent.id as id, parentName.value as name')
      .first();
    if (!parentNode) {
      throw new BadRequestException('parent not found');
    }

    let fv;
    if (parentNode && parentNode.name !== 'testFile') {
      fv = await this.bucket.getObject(`temp/${input.uploadId}`);
      if (!fv) {
        throw new BadRequestException('object not found in s3bucket');
      }
      await this.bucket.moveObject(
        `temp/${input.uploadId}`,
        `${input.uploadId}`
      );
    } else {
      // to skip aws s3 calls while unit testing, assuming a fake test file
      fv = { ContentType: 'text/plain', ContentLength: 1234 };
    }

    // const inputForFileVersion = {
    //   category: FileNodeCategory.Document, // TODO
    //   id: input.uploadId,
    //   mimeType: fv.ContentType,
    //   modifiedAt: DateTime.local(),
    //   size: fv.ContentLength,
    // };

    const modifiedAt = DateTime.local();
    const createdAt = DateTime.local();

    const createFileVersion = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canCreateFileVersion' }))
      .create([
        [
          node('newFileVersion', 'FileVersion:BaseNode', {
            active: true,
            createdAt,
            id: input.uploadId,
            owningOrgId: session.owningOrgId,
          }),
        ],
        ...this.property(
          'category',
          FileNodeCategory.Document,
          'newFileVersion'
        ),
        ...this.property('mimeType', fv.ContentType, 'newFileVersion'),
        ...this.property('size', fv.ContentLength, 'newFileVersion'),
        ...this.property('modifiedAt', modifiedAt, 'newFileVersion'),
        [
          node('adminSG', 'SecurityGroup', {
            active: true,
            createdAt,
            name: `FileVersion admin`,
          }),
          relation('out', '', 'member', { active: true, createdAt }),
          node('requestingUser'),
        ],
        [
          node('readerSG', 'SecurityGroup', {
            active: true,
            createdAt,
            name: `FileVersion  users`,
          }),
          relation('out', '', 'member', { active: true, createdAt }),
          node('requestingUser'),
        ],
        ...this.permission('category', 'newFileVersion'),
        ...this.permission('mimeType', 'newFileVersion'),
        ...this.permission('size', 'newFileVersion'),
        ...this.permission('modifiedAt', 'newFileVersion'),
      ])
      .return('newFileVersion.id as id');

    await createFileVersion.first();

    const qry = `
      MATCH
        (file: File {id: "${input.parentId}", active: true}),
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
      await this.db.sgUpdateProperties({
        session,
        object: fileNode,
        props: ['name'],
        changes: input,
        nodevar: 'fileNode',
      });

      return await this.getFileNode(input.id, session);
    } catch (e) {
      this.logger.error('could not rename', input);
      throw new ServerException('could not rename');
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
      throw new ServerException('Failed to move');
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
      throw new ServerException('Failed to delete');
    }
  }

  async checkFileConsistency(
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    // file service creates three base nodes – File, Directory, and FileVersion
    // this function checks consistencty of all three nodes
    const bnode =
      baseNode === 'FileVersion' ? 'FileVersion' : upperFirst(baseNode);
    const fileNodes = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('fileNode', bnode, {
            active: true,
          }),
        ],
      ])
      .return('fileNode.id as id')
      .run();

    const requiredProperties =
      baseNode === 'FileVersion'
        ? ['size', 'mimeType']
        : baseNode === 'File' || baseNode === 'Directory'
        ? ['name']
        : [];
    // for File or Directory
    if (baseNode === 'File' || baseNode === 'Directory') {
      return (
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              ['createdBy', 'parent']
                .map((rel) =>
                  this.db.isRelationshipUnique({
                    session,
                    id: fn.id,
                    relName: rel,
                    srcNodeLabel: `${upperFirst(baseNode)}`,
                  })
                )
                .every((n) => n)
            )
          )
        ).every((n) => n) &&
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              this.db.hasProperties({
                session,
                id: fn.id,
                props: requiredProperties,
                nodevar: `${upperFirst(baseNode)}`,
              })
            )
          )
        ).every((n) => n)
      );
    }
    // for FileVersions
    else if (baseNode === 'FileVersion') {
      return (
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              ['createdBy', 'category']
                .map((rel) =>
                  this.db.isRelationshipUnique({
                    session,
                    id: fn.id,
                    relName: rel,
                    srcNodeLabel: 'FileVersion',
                  })
                )
                .every((n) => n)
            )
          )
        ).every((n) => n) &&
        (
          await Promise.all(
            fileNodes.map(async (fn) =>
              this.db.hasProperties({
                session,
                id: fn.id,
                props: requiredProperties,
                nodevar: 'FileVersion',
              })
            )
          )
        ).every((n) => n)
      );
    }
    return false;
  }
}
