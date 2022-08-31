import { InputType, ObjectType } from '@nestjs/graphql';
import {
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Comment } from './comment.dto';

@InputType()
export class CommentListInput extends SortablePaginationInput<keyof Comment>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new CommentListInput();
}

@ObjectType()
export class CommentListOutput extends PaginatedList(Comment) {}

@ObjectType({
  description: SecuredList.descriptionFor('comments'),
})
export abstract class SecuredCommentList extends SecuredList(Comment) {}
