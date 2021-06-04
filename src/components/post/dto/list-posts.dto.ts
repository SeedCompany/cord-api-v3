import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  IdField,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Post } from './post.dto';

@InputType()
export abstract class PostFilters {
  @IdField({ nullable: true })
  readonly parentId?: ID;
}

const defaultFilters = {};

@InputType()
export class PostListInput extends SortablePaginationInput<keyof Post>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new PostListInput();

  @Field({ nullable: true })
  @Type(() => PostFilters)
  @ValidateNested()
  readonly filter: PostFilters = defaultFilters;
}

@ObjectType()
export class PostListOutput extends PaginatedList(Post) {}

@ObjectType({
  description: SecuredList.descriptionFor('posts'),
})
export abstract class SecuredPostList extends SecuredList(Post) {}
