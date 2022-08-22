import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Comment } from './comment.dto';

@InputType()
export abstract class CommentFilters {
  readonly threadId: ID;
}

@InputType()
export class CommentListInput extends SortablePaginationInput<keyof Comment>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new CommentListInput();

  @Type(() => CommentFilters)
  @ValidateNested()
  readonly filter: CommentFilters;
}

@ObjectType()
export class CommentListOutput extends PaginatedList(Comment) {}

@ObjectType({
  description: SecuredList.descriptionFor('comments'),
})
export abstract class SecuredCommentList extends SecuredList(Comment) {}
