import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export abstract class UpdateComment {
  @IdField()
  readonly id: ID;

  @RichTextField({ optional: true })
  readonly body?: RichTextDocument;
}

@ObjectType()
export abstract class CommentUpdated {
  @Field()
  readonly comment: Comment;
}
