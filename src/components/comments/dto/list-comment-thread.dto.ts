import { InputType, ObjectType } from '@nestjs/graphql';
import {
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
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
export class CommentThreadListOutput extends PaginatedList(CommentThread) {}

@ObjectType({
  description: SecuredList.descriptionFor('comment threads'),
})
export abstract class SecuredCommentThreadList extends SecuredList(
  CommentThread
) {}
