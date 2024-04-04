import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export abstract class CreateCommentInput {
  @IdField({ nullable: true })
  readonly threadId?: ID;

  @IdField()
  readonly resourceId: ID;

  @RichTextField()
  readonly body: RichTextDocument;
}

@ObjectType()
export abstract class CreateCommentOutput {
  @Field()
  readonly comment: Comment;
}
