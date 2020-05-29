import { Field, ID, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

@InputType()
export abstract class RenameFileInput {
  @Field(() => ID, {
    description: "The file node's ID",
  })
  readonly id: string;

  @Field({
    description: 'The new name',
  })
  readonly name: string;
}

@InputType()
export abstract class MoveFileInput {
  @Field(() => ID, {
    description: "The file or directory's ID",
  })
  readonly id: string;

  @Field(() => ID, {
    description: 'The new parent ID',
  })
  readonly parentId: string;

  @Field({
    description: stripIndent`
      Optionally change the name as well.
      Could be helpful for if the destination has a node with the same name.
    `,
    nullable: true,
  })
  readonly name?: string;
}
