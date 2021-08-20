import { Field, Int, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { ConditionalExcept, MergeExclusive, Opaque } from 'type-fest';
import {
  DateTimeField,
  ID,
  NameField,
  Resource,
  Secured,
  SecuredProperty,
  SecuredProps,
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

@InterfaceType({
  resolveType: (val: AnyFileNode) =>
    simpleSwitch(val.type, {
      [FileNodeType.Directory]: Directory,
      [FileNodeType.File]: File,
      [FileNodeType.FileVersion]: FileVersion,
    }),
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

export type BaseNode = ConditionalExcept<FileNode, never>;

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
  isDirectoryNode(node);
export const isDirectoryNode = (node: BaseNode) =>
  node.type === FileNodeType.Directory;

export const isFile = (node: AnyFileNode): node is File => isFileNode(node);
export const isFileNode = (node: BaseNode) => node.type === FileNodeType.File;

export const isFileVersion = (node: AnyFileNode): node is FileVersion =>
  isFileVersionNode(node);
export const isFileVersionNode = (node: BaseNode) =>
  node.type === FileNodeType.FileVersion;
