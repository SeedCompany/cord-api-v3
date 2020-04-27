import { Type } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import {
  createUnionType,
  Field,
  InputType,
  Int,
  InterfaceType,
  ObjectType,
} from 'type-graphql';
import { DateTimeField, Resource } from '../../../common';
import { User } from '../../user/dto';
import { FileNodeCategory } from './category';
import { FileNodeType } from './type';

@InterfaceType()
@ObjectType({
  isAbstract: true,
  implements: [Resource],
})
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

  @Field(() => [Directory], {
    description: stripIndent`
      A list of the parents all the way up the tree.
      This can be used to populate a path-like UI,
      without having to fetch each parent serially.
    `,
  })
  readonly parents: readonly Directory[];

  @Field({
    description: 'The user who created this node',
  })
  readonly createdBy: User;
}

@ObjectType({
  implements: [FileNode],
})
export class File extends FileNode {
  /* TS wants a public constructor for "ClassType" */
  static classType = (File as any) as Type<File>;

  type: FileNodeType.File;

  @Field({
    description: 'The user who uploaded the first version of this file',
  })
  readonly createdBy: User;

  @Field({
    description: 'The user who uploaded the most recent version of this file',
  })
  readonly modifiedBy: User;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @Field()
  readonly mimeType: string;

  @Field(() => Int)
  readonly size: number;
}

@ObjectType({
  implements: [FileNode],
})
export class Directory extends FileNode {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Directory as any) as Type<Directory>;

  readonly type: FileNodeType.Directory;

  @Field({
    description: 'The user who created this directory',
  })
  readonly createdBy: User;
}

@ObjectType({
  implements: [Resource],
})
export class FileVersion extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (FileVersion as any) as Type<FileVersion>;

  @Field({
    description: 'The user who created this file version',
  })
  readonly createdBy: User;

  @Field(() => Int)
  readonly size: number;
}

export const FileOrDirectory = createUnionType({
  name: 'FileOrDirectory',
  description: '',
  types: () => [File.classType, Directory.classType],
  resolveType: (value) =>
    value.type === FileNodeType.Directory
      ? Directory.classType
      : File.classType,
});
export type FileOrDirectory = File | Directory;

@InputType()
export abstract class BaseNodeConsistencyInput {
  @Field({
    description: 'The BaseNode type',
  })
  readonly baseNode: string;
}
