import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  OptionalField,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { PostType } from './post-type.enum';
import { Post } from './post.dto';

@InputType()
export abstract class PostFilters {
  /**
   * Server-side only — no `@Field`, so callers cannot set it. The Postable
   * resolver always overwrites it with the parent it is resolving for.
   */
  readonly parentId?: ID;

  @OptionalField(() => [PostType], {
    description: `
      Only these kinds of post.

      Exists so a surface dedicated to one kind — an engagement's prayer feed,
      say — can page through just that kind. Filtering after the fetch instead
      would make page sizes lie, since the server would count and slice over
      everything.
    `,
  })
  readonly types?: readonly PostType[];
}

@InputType()
export class PostListInput extends SortablePaginationInput<keyof Post>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {
  @FilterField(() => PostFilters)
  readonly filter?: PostFilters;
}

@ObjectType()
export class PostListOutput extends PaginatedList(Post) {}

@ObjectType({
  description: SecuredList.descriptionFor('posts'),
})
export abstract class SecuredPostList extends SecuredList(Post) {}
