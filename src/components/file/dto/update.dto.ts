import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField, NameField } from '../../../common';

@InputType()
export abstract class RenameFileInput {
  @IdField({
    description: "The file node's ID",
  })
  readonly id: ID;

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
  readonly id: ID;

  @IdField({
    description: 'The new parent ID',
  })
  readonly parentId: ID;

  @Field({
    description: stripIndent`
      Optionally change the name as well.
      Could be helpful for if the destination has a node with the same name.
    `,
    nullable: true,
  })
  readonly name?: string;
}
