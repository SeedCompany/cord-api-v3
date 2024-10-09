import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Order, SecuredList, SortablePaginationInput } from '~/common';
import { CommentThread } from './comment-thread.dto';
import { Commentable } from './commentable.dto';

@InputType()
export class CommentThreadListInput extends SortablePaginationInput<
  keyof CommentThread
>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {}

@ObjectType()
export class CommentThreadList extends SecuredList(CommentThread) {
  @Field()
  readonly parent: Commentable;
}
