import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { CommentThread } from './comment-thread.dto';

@InputType()
export class CreateCommentThread {
  @IdField()
  readonly parentId: ID;
}

@InputType()
export abstract class CreateCommentThreadInput {
  @Field()
  @Type(() => CreateCommentThread)
  @ValidateNested()
  readonly commentThread: CreateCommentThread;
}

@ObjectType()
export abstract class CreateCommentThreadOutput {
  @Field()
  readonly commentThread: CommentThread;
}
