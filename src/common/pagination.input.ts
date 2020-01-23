import { Max, Min } from 'class-validator';
import { stripIndent } from 'common-tags';
import { Field, InputType, Int } from 'type-graphql';
import { Order } from './order.enum';

@InputType({
  isAbstract: true,
})
export abstract class PaginationInput {
  @Field(() => Int, {
    description: 'The number of items to return in a single page',
  })
  @Min(1)
  @Max(100)
  readonly count = 25;

  @Field(() => Int, {
    description: stripIndent`
      1-indexed page number for offset pagination.
    `,
    nullable: true,
  })
  @Min(1)
  readonly page = 1;

  protected constructor() {
    // no instantiation, shape only
  }
}

@InputType({
  isAbstract: true,
})
export abstract class CursorPaginationInput {
  @Field(() => Int, {
    description: 'The number of items to return in a single page',
  })
  readonly count = 25;

  @Field({
    description: stripIndent`
      Return items starting after this cursor.
      This usually is the endCursor from the previous page/call to fetch the next page.
    `,
    nullable: true,
  })
  readonly after?: string;

  @Field({
    description: stripIndent`
      Return items starting before this cursor.
      This usually is the startCursor from the previous page/call to fetch the previous page.
    `,
    nullable: true,
  })
  readonly before?: string;

  protected constructor() {
    // no instantiation, shape only
  }
}

@InputType({
  isAbstract: true,
})
export abstract class SortablePaginationInput extends PaginationInput {
  @Field({
    nullable: true,
    description: 'The field in which to sort on',
  })
  readonly sort?: string;

  @Field(() => Order, {
    description: 'The order in which to sort the list',
  })
  readonly order = Order.ASC;
}
