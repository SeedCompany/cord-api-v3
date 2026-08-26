import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { type PostType } from './post-type.enum';
import { Post } from './post.dto';

@InputType()
export abstract class PostFilters {
  readonly parentId?: ID;

  /**
   * Internal, like `parentId`: set by a resolver that owns a single kind of
   * post — GTL's prayer section — never by a caller.
   */
  readonly type?: PostType;
}

@InputType()
export class PostListInput extends SortablePaginationInput<keyof Post>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  @FilterField(() => PostFilters, { internal: true })
  readonly filter?: PostFilters;
}

@ObjectType()
export class PostListOutput extends PaginatedList(Post) {}

@ObjectType({
  description: SecuredList.descriptionFor('posts'),
})
export abstract class SecuredPostList extends SecuredList(Post) {}
