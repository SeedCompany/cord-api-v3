import { Field, Int, InterfaceType, ObjectType } from '@nestjs/graphql';
import { simpleSwitch } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { type Readable } from 'stream';
import { type MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  DbLabel,
  type ID,
  type IdOf,
  InputException,
  NameField,
  Resource,
  type Secured,
  SecuredProperty,
  ServerException,
} from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { FileNodeType } from './file-node-type.enum';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete nodes.
 */
export type AnyFileNode = MergeExclusive<MergeExclusive<File, Directory>, FileVersion>;

export const resolveFileNode = (val: AnyFileNode) => {
  const type = simpleSwitch(val.type, {
    [FileNodeType.Directory]: Directory,
    [FileNodeType.File]: File,
    [FileNodeType.FileVersion]: FileVersion,
  });
  if (!type) {
    throw new ServerException('Could not resolve file node type');
  }
  return type;
};

@RegisterResource({ db: e.File.Node })
@InterfaceType({
  resolveType: resolveFileNode,
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
abstract class FileNode extends Resource {
  @Field(() => FileNodeType)
  readonly type: FileNodeType;

  @NameField({
    description: stripIndent`
      The name of the node.
      This is user defined but does not necessarily need to be url safe.
    `,
  })
  readonly name: string;

  @Field({
    description: 'Is this available to anyone anonymously?',
  })
  readonly public: boolean;

  readonly createdById: ID;

  /** The root FileNode. This could be self */
  readonly root: BaseNode;

  /** The resource the root FileNode is attached to */
  readonly rootAttachedTo: [resource: BaseNode, relationName: string];
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { FileNode as IFileNode, type AnyFileNode as FileNode };

@ObjectType({
  isAbstract: true,
})
@DbLabel(null)
/**
 * Both file and file version have these properties
 */
abstract class BaseFile extends FileNode {
  @Field()
  readonly mimeType: string;

  @Field(() => Int, {
    description: 'The total size in bytes of this file',
  })
  readonly size: number;
}

@RegisterResource({ db: e.File.Version })
@ObjectType({
  implements: [FileNode, Resource],
})
export class FileVersion extends BaseFile {
  declare readonly type: 'FileVersion';
}

@RegisterResource({ db: e.File })
@ObjectType({
  implements: [FileNode, Resource],
})
export class File extends BaseFile {
  declare readonly type: 'File';

  readonly latestVersionId: ID;

  readonly modifiedById: ID;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@RegisterResource({ db: e.Directory })
@ObjectType({
  implements: [FileNode, Resource],
})
export class Directory extends FileNode {
  declare readonly type: 'Directory';

  @Field(() => Int, {
    description:
      'The total size in bytes of all files under this directory and all its subdirectories',
  })
  readonly size: number;

  @Field(() => Int, {
    description: 'The total number of files under this directory and all its subdirectories',
  })
  readonly totalFiles: number;

  readonly firstFileCreated?: ID;

  readonly modifiedBy: ID;

  @DateTimeField({
    description:
      'The `DateTime` a file was most recently modified in this directory or any subdirectories',
  })
  readonly modifiedAt: DateTime;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a directory'),
})
export abstract class SecuredDirectory extends SecuredProperty(Directory) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a file'),
})
export abstract class SecuredFile extends SecuredProperty(File) {}

/**
 * A reference to a secured defined file. The value is the ID of the file.
 */
export type DefinedFile = Secured<FileId>;

export type FileId = IdOf<'File'>;

export const isDirectory = (node: AnyFileNode): node is Directory =>
  node.type === FileNodeType.Directory;

export const asDirectory = (node: AnyFileNode) => {
  if (!isDirectory(node)) {
    throw new InputException('Node is not a directory');
  }
  return node;
};

export const isFile = (node: AnyFileNode): node is File => node.type === FileNodeType.File;

export const asFile = (node: AnyFileNode) => {
  if (!isFile(node)) {
    throw new InputException('Node is not a file');
  }
  return node;
};

export const isFileVersion = (node: AnyFileNode): node is FileVersion =>
  node.type === FileNodeType.FileVersion;

export type Downloadable<T> = T & {
  download: () => Promise<Buffer>;
  stream: () => Promise<Readable>;
};

declare module '~/core/resources/map' {
  interface ResourceMap {
    Directory: typeof Directory;
    File: typeof File;
    FileNode: typeof FileNode;
    FileVersion: typeof FileVersion;
  }
  interface ResourceDBMap {
    Directory: typeof e.Directory;
    File: typeof e.default.File;
    FileNode: typeof e.File.Node;
    FileVersion: typeof e.File.Version;
  }
}
