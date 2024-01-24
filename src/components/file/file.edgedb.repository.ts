import { Injectable } from '@nestjs/common';
import { ID, NotImplementedException, PublicOf, Session } from '~/common';
import { LinkTo } from '~/core';
import { castToEnum, e, RepoFor, ScopeOf } from '~/core/edgedb';
import {
  FileListInput,
  FileNode,
  FileNodeType,
  FileVersion,
  IFileNode,
} from './dto';
import { FileRepository as Neo4jRepository } from './file.repository';

@Injectable()
export class FileEdgeDBRepository
  extends RepoFor(IFileNode, {
    hydrate: (node: ScopeOf<typeof e.File.Node>) => {
      const type = e.str_replace(
        e.str_replace(node.__type__.name, 'default', ''),
        '::',
        '',
      );
      const root = e.op(node.root, '??', node);
      return {
        id: true,
        createdAt: true,
        type: castToEnum(type, FileNodeType),
        name: true,
        public: e.op(node.public, '??', false), // TODO cardinality doesn't change for stored pointers
        createdById: node.createdBy.id,
        root: e.tuple({
          identity: node.id,
          labels: e.array_agg(e.set(type)),
          properties: e.tuple({
            id: root.id,
            createdAt: root.createdAt,
          }),
        }),
        rootAttachedTo: e.tuple([
          e.tuple({
            identity: node.container.id,
            labels: e.array_agg(e.set(node.container.__type__.name)),
            properties: e.tuple({
              id: node.container.id,
              createdAt: node.container.createdAt,
            }),
          }),
          e.str(''), // stubbed relation name, not used by app code.
        ]),
        size: true,
        mimeType: e.op(
          node.is(e.File).mimeType,
          '??',
          node.is(e.File.Version).mimeType,
        ),
        latestVersionId: node.is(e.File).latestVersion.id,
        modifiedById: node.modifiedBy.id,
        modifiedAt: true,
        totalFiles: e.op(node.is(e.Directory).totalFiles, '??', 0),
        canDelete: e.bool(false),
      };
    },
    omit: ['create', 'delete'],
  })
  implements PublicOf<Neo4jRepository>
{
  async getById(id: ID): Promise<FileNode> {
    const x = await this.readOne(id);
    const y: FileNodeType = x.type;
    return x;
  }

  async getByIds(ids: readonly ID[]) {
    return await this.readMany(ids);
  }

  async getByName(parentId: ID, name: string): Promise<FileNode> {
    throw new NotImplementedException();
  }

  async getParentsById(id: ID): Promise<readonly FileNode[]> {
    throw new NotImplementedException();
  }

  async getChildrenById(
    parent: FileNode,
    input?: FileListInput,
  ): Promise<never> {
    input ??= FileListInput.defaultValue(FileListInput);
    throw new NotImplementedException();
  }

  async getBaseNode(id: ID): Promise<never> {
    throw new NotImplementedException();
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    session: Session,
    { public: isPublic }: { public?: boolean } = {},
  ): Promise<ID> {
    throw new NotImplementedException();
  }

  async createRootDirectory({
    resource,
    relation,
    name,
    public: isPublic,
    session,
  }: {
    resource: LinkTo<any>;
    relation: string;
    name: string;
    public?: boolean;
    session: Session;
  }): Promise<never> {
    throw new NotImplementedException();
  }

  async createFile({
    fileId,
    name,
    session,
    parentId,
    propOfNode,
    public: isPublic,
  }: {
    fileId: ID;
    name: string;
    session: Session;
    parentId?: ID;
    propOfNode?: [baseNodeId: ID, propertyName: string];
    public?: boolean;
  }): Promise<never> {
    throw new NotImplementedException();
  }

  async createFileVersion(
    fileId: ID,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size'> & {
      public?: boolean;
    },
    session: Session,
  ): Promise<never> {
    throw new NotImplementedException();
  }

  async rename(fileNode: FileNode, newName: string): Promise<never> {
    throw new NotImplementedException();
  }

  async move(id: ID, newParentId: ID): Promise<never> {
    throw new NotImplementedException();
  }

  async delete(node: FileNode) {
    await this.defaults.delete(node.id);
  }
}
