import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export abstract class CreateCommentInput {
  @IdField({ nullable: true })
  readonly thread?: ID<'CommentThread'>;

  @IdField()
  readonly resource: ID;

  @RichTextField()
  readonly body: RichTextDocument;
}

@ObjectType()
export abstract class CreateCommentOutput {
  @Field()
  readonly comment: Comment;
}
