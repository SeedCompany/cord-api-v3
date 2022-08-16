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
import { CommentThread } from './comment-thread.dto';

@InputType()
export abstract class CommentThreadFilters {
  readonly parentId?: ID;
}

const defaultFilters = {};

@InputType()
export class CommentThreadListInput extends SortablePaginationInput<
  keyof CommentThread
>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new CommentThreadListInput();

  @Type(() => CommentThreadFilters)
  @ValidateNested()
  readonly filter: CommentThreadFilters = defaultFilters;
}

@ObjectType()
export class CommentThreadListOutput extends PaginatedList(CommentThread) {}

@ObjectType({
  description: SecuredList.descriptionFor('comment threads'),
})
export abstract class SecuredCommentThreadList extends SecuredList(
  CommentThread
) {}
