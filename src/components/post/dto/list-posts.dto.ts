import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Post } from './post.dto';

@InputType()
export abstract class PostFilters {
  readonly parentId?: ID;
}

@InputType()
export class PostListInput extends SortablePaginationInput<keyof Post>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  @FilterField(PostFilters, { internal: true })
  readonly filter: PostFilters;
}

@ObjectType()
export class PostListOutput extends PaginatedList(Post) {}

@ObjectType({
  description: SecuredList.descriptionFor('posts'),
})
export abstract class SecuredPostList extends SecuredList(Post) {}
