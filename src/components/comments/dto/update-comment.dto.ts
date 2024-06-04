import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export abstract class UpdateCommentInput {
  @IdField()
  readonly id: ID;

  @RichTextField({ nullable: true })
  readonly body?: RichTextDocument;
}

@ObjectType()
export abstract class UpdateCommentOutput {
  @Field()
  readonly comment: Comment;
}
