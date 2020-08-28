import { Field, Int, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { ConditionalExcept, MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  Resource,
  Secured,
  SecuredProperty,
  simpleSwitch,
} from '../../../common';
import { FileNodeCategory } from './category';
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
  @Field(() => FileNodeType)
  readonly type: FileNodeType;

  @Field(() => FileNodeCategory)
  readonly category: FileNodeCategory;

  @Field({
    description: stripIndent`
      The name of the node.
      This is user defined but does not necessarily need to be url safe.
    `,
  })
  readonly name: string;

  readonly createdById: string;
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { FileNode as IFileNode, AnyFileNode as FileNode };

export type BaseNode = ConditionalExcept<FileNode, never | FileNodeCategory>;

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
  readonly type: FileNodeType.FileVersion;
}

@ObjectType({
  implements: [FileNode, Resource],
})
export class File extends BaseFile {
  readonly type: FileNodeType.File;

  readonly latestVersionId: string;

  readonly modifiedById: string;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  implements: [FileNode, Resource],
})
export class Directory extends FileNode {
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
export type DefinedFile = Secured<string>;

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
