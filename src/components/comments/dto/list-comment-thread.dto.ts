import { InputType, ObjectType } from '@nestjs/graphql';
import { Order, PaginatedList, SortablePaginationInput } from '../../../common';
import { CommentThread } from './comment-thread.dto';

@InputType()
export class CommentThreadListInput extends SortablePaginationInput<
  keyof CommentThread
>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new CommentThreadListInput();
}

@ObjectType()
export class CommentThreadList extends PaginatedList(CommentThread) {}
