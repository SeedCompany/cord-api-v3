import { PipeTransform, Type } from '@nestjs/common';
import { Args, ArgsOptions, Field, InputType, Int } from '@nestjs/graphql';
import { setHas } from '@seedcompany/common';
import { Matches, Max, Min } from 'class-validator';
import { stripIndent } from 'common-tags';
import { DataObject } from './data-object';
import { DefaultValue } from './default-value';
import { Order } from './order.enum';
import { AbstractClassType } from './types';

@InputType({
  isAbstract: true,
})
export abstract class PaginationInput extends DataObject {
  @Field(() => Int, {
    description: 'The number of items to return in a single page',
  })
  @Min(1)
  @Max(100)
  readonly count: number = 25;

  @Field(() => Int, {
    description: stripIndent`
      1-indexed page number for offset pagination.
    `,
    nullable: true,
  })
  @Min(1)
  readonly page: number = 1;
}

export const isPaginationInput = (input: unknown): input is PaginationInput =>
  !!input &&
  typeof input === 'object' &&
  'count' in input &&
  typeof input.count === 'number' &&
  'page' in input &&
  typeof input.page === 'number';

@InputType({
  isAbstract: true,
})
export abstract class CursorPaginationInput extends DataObject {
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
}

export interface SortablePaginationInput<SortKey extends string = string>
  extends PaginationInput {
  sort: SortKey;
  order: Order;
}

export const isSortablePaginationInput = (
  input: unknown,
): input is SortablePaginationInput =>
  isPaginationInput(input) &&
  'sort' in input &&
  typeof input.sort === 'string' &&
  'order' in input &&
  typeof input.order === 'string' &&
  setHas(Order.values, input.order);

export const SortablePaginationInput = <SortKey extends string = string>({
  defaultSort,
  defaultOrder,
}: {
  defaultSort: SortKey;
  defaultOrder?: Order;
}) => {
  @InputType({
    isAbstract: true,
  })
  abstract class SortablePaginationInputClass
    extends PaginationInput
    implements SortablePaginationInput<SortKey>
  {
    @Field(() => String, {
      nullable: true,
      description: 'The field in which to sort on',
      defaultValue: defaultSort,
    })
    @Matches(/^[A-Za-z0-9_.]+$/)
    readonly sort: SortKey = defaultSort;

    @Field(() => Order, {
      description: 'The order in which to sort the list',
      defaultValue: defaultOrder ?? Order.ASC,
    })
    readonly order: Order = defaultOrder ?? Order.ASC;
  }

  return SortablePaginationInputClass;
};

/**
 * A GQL argument for paginated list input
 */
export const ListArg = <T extends PaginationInput>(
  input: AbstractClassType<T>,
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) =>
  Args(
    {
      name: 'input',
      type: () => input,
      nullable: true,
      defaultValue: DataObject.defaultValue(input, DefaultValue.Get(input)),
      ...opts,
    },
    ...pipes,
  );
