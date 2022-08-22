import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';
import { CommentThread } from './comment-thread.dto';

@InputType()
export abstract class CreateCommentThreadInput {
  @IdField()
  readonly parentId: ID;
}

@ObjectType()
export abstract class CreateCommentThreadOutput {
  @Field()
  readonly commentThread: CommentThread;
}
