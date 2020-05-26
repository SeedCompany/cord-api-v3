import { Type } from '@nestjs/common';
import {
  Field,
  InputType,
  Int,
  InterfaceType,
  ObjectType,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import { DateTimeField, Resource, simpleSwitch } from '../../../common';
import { User } from '../../user/dto';
import { FileNodeCategory } from './category';
import { FileNodeType } from './type';

/**
 * This should be used for TypeScript types as we'll always be passing around
 * concrete nodes.
 */
export type FileNode = MergeExclusive<
  MergeExclusive<File, Directory>,
  FileVersion
>;

@InterfaceType('FileNode', {
  resolveType: (val: FileNode) =>
    simpleSwitch(val.type, {
      [FileNodeType.Directory]: Directory.classType,
      [FileNodeType.File]: File.classType,
      [FileNodeType.FileVersion]: FileVersion.classType,
    }),
})
@ObjectType({
  isAbstract: true,
  implements: [Resource],
})
/**
 * This should be used for GraphQL but never for TypeScript types.
 */
export abstract class IFileNode extends Resource {
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

  @Field(() => [IFileNode], {
    description: stripIndent`
      A list of the parents all the way up the tree.
      This can be used to populate a path-like UI,
      without having to fetch each parent serially.
    `,
  })
  readonly parents?: never;

  readonly createdById: string;
  @Field(() => User, {
    description: 'The user who created this node',
  })
  readonly createdBy?: never;
}

@ObjectType({
  isAbstract: true,
  implements: [IFileNode],
})
/**
 * Both file and file version have these properties
 */
abstract class BaseFile extends IFileNode {
  @Field()
  readonly mimeType: string;

  @Field(() => Int)
  readonly size: number;
}

@ObjectType({
  implements: [IFileNode],
})
export class FileVersion extends BaseFile {
  /* TS wants a public constructor for "ClassType" */
  static classType = (FileVersion as any) as Type<FileVersion>;

  readonly type: FileNodeType.FileVersion;
}

@ObjectType({
  implements: [IFileNode],
})
export class File extends BaseFile {
  /* TS wants a public constructor for "ClassType" */
  static classType = (File as any) as Type<File>;

  readonly type: FileNodeType.File;

  readonly modifiedById: string;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  implements: [IFileNode],
})
export class Directory extends IFileNode {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Directory as any) as Type<Directory>;

  readonly type: FileNodeType.Directory;
}

@InputType()
export abstract class BaseNodeConsistencyInput {
  @Field({
    description: 'The BaseNode type',
  })
  readonly baseNode: string;
}
