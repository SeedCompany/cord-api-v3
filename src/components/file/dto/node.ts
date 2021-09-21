import { Field, Int, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive, Opaque } from 'type-fest';
import {
  DateTimeField,
  ID,
  InputException,
  NameField,
  Resource,
  Secured,
  SecuredProperty,
  SecuredProps,
  ServerException,
  simpleSwitch,
} from '../../../common';
import { FileNodeType } from './type';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete nodes.
 */
export type AnyFileNode = MergeExclusive<
  MergeExclusive<File, Directory>,
  FileVersion
>;

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

@InterfaceType({
  resolveType: resolveFileNode,
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
abstract class FileNode extends Resource {
  static readonly Props: string[] = keysOf<FileNode>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<FileNode>>();

  @Field(() => FileNodeType)
  readonly type: FileNodeType;

  @NameField({
    description: stripIndent`
      The name of the node.
      This is user defined but does not necessarily need to be url safe.
    `,
  })
  readonly name: string;

  readonly createdById: ID;
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { FileNode as IFileNode, AnyFileNode as FileNode };

@ObjectType({
  isAbstract: true,
})
/**
 * Both file and file version have these properties
 */
abstract class BaseFile extends FileNode {
  @Field()
  readonly mimeType: string;

  @Field(() => Int)
  readonly size: number;
}

@ObjectType({
  implements: [FileNode, Resource],
})
export class FileVersion extends BaseFile {
  static readonly Props = keysOf<FileVersion>();
  static readonly SecuredProps = keysOf<SecuredProps<FileVersion>>();

  readonly type: FileNodeType.FileVersion;
}

@ObjectType({
  implements: [FileNode, Resource],
})
export class File extends BaseFile {
  static readonly Props = keysOf<File>();
  static readonly SecuredProps = keysOf<SecuredProps<File>>();

  readonly type: FileNodeType.File;

  readonly latestVersionId: ID;

  readonly modifiedById: ID;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  implements: [FileNode, Resource],
})
export class Directory extends FileNode {
  static readonly Props = keysOf<Directory>();
  static readonly SecuredProps = keysOf<SecuredProps<Directory>>();

  readonly type: FileNodeType.Directory;
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

export type FileId = ID & Opaque<string, 'FileId'>;

export const isDirectory = (node: AnyFileNode): node is Directory =>
  node.type === FileNodeType.Directory;

export const asDirectory = (node: AnyFileNode) => {
  if (!isDirectory(node)) {
    throw new InputException('Node is not a directory');
  }
  return node;
};

export const isFile = (node: AnyFileNode): node is File =>
  node.type === FileNodeType.File;

export const asFile = (node: AnyFileNode) => {
  if (!isFile(node)) {
    throw new InputException('Node is not a file');
  }
  return node;
};

export const isFileVersion = (node: AnyFileNode): node is FileVersion =>
  node.type === FileNodeType.FileVersion;
