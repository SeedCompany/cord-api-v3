import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { IdField, IdOf, NameField } from '~/common';
import { Directory, IFileNode } from './node';

@InputType()
export abstract class RenameFileInput {
  @IdField({
    description: "The file node's ID",
  })
  readonly id: IdOf<IFileNode>;

  @NameField({
    description: 'The new name',
  })
  readonly name: string;
}

@InputType()
export abstract class MoveFileInput {
  @IdField({
    description: "The file or directory's ID",
  })
  readonly id: IdOf<IFileNode>;

  @IdField({
    description: 'The new parent ID',
  })
  readonly parentId: IdOf<Directory>;

  @Field({
    description: stripIndent`
      Optionally change the name as well.
      Could be helpful for if the destination has a node with the same name.
    `,
    nullable: true,
  })
  readonly name?: string;
}
