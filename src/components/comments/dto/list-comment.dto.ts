import { InputType, ObjectType } from '@nestjs/graphql';
import { Order, PaginatedList, SortablePaginationInput } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export class CommentListInput extends SortablePaginationInput<keyof Comment>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new CommentListInput();
}

@ObjectType()
export abstract class CommentList extends PaginatedList(Comment) {}
