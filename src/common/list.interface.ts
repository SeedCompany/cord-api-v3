import { Field, Int, InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

// Don't use this directly but instead use PaginatedList from ./paginated-list.
@InterfaceType({
  description: stripIndent`
    A paginated list.
    Implementations will have an \`items\` list property.
    It just cannot be defined here due to GraphQL limitations.
  `,
})
abstract class PaginatedList {
  @Field(() => Int, {
    description: 'The total number of items across all pages',
  })
  readonly total: number;

  @Field({
    description: 'Whether the next page exists',
  })
  readonly hasMore: boolean;
}

export { PaginatedList as IPaginatedList };
