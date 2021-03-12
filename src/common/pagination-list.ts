import { Field, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLScalarType } from 'graphql';
import { Class } from 'type-fest';
import { Cursor, CursorField } from './cursor.scalar';
import { IPaginatedList } from './list.interface';
import { AbstractClassType } from './types';

export interface ListOptions {
  itemsDescription?: string;
}

export interface PaginatedListType<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly startCursor?: Cursor;
  readonly endCursor?: Cursor;
  readonly hasNextPage?: boolean;
  readonly hasPreviousPage?: boolean;
  /** @deprecated */
  readonly hasMore: boolean;
}

export function PaginatedList<Type, ListItem = Type>(
  itemClass: Class<Type> | AbstractClassType<Type> | GraphQLScalarType,
  options: ListOptions = {}
) {
  @ObjectType({ isAbstract: true, implements: [IPaginatedList] })
  abstract class PaginatedListClass
    implements PaginatedListType<ListItem>, IPaginatedList
  {
    @Field(() => [itemClass], {
      description:
        options.itemsDescription ||
        PaginatedList.itemDescriptionFor(itemClass.name.toLowerCase()),
    })
    readonly items: readonly ListItem[];

    @Field(() => Int, {
      description: 'The total number of items across all pages',
    })
    readonly total: number;

    @Field({
      description: 'Whether the next page exists',
      deprecationReason: 'Use hasNextPage instead',
    })
    readonly hasMore: boolean;

    @CursorField({
      description:
        'When paginating backwards, pass this as the before argument to continue',
    })
    readonly startCursor?: Cursor;

    @CursorField({
      description:
        'When paginating forwards, pass this as the after argument to continue',
    })
    readonly endCursor?: Cursor;

    @Field({
      description: 'When paginating forwards, are there more items?',
    })
    readonly hasNextPage?: boolean;

    @Field({
      description: 'When paginating backwards, are there more items?',
    })
    readonly hasPreviousPage?: boolean;

    protected constructor() {
      // no instantiation, shape only
    }
  }

  return PaginatedListClass;
}

PaginatedList.itemDescriptionFor = (name: string) => stripIndent`
  The page of ${name}.
  Note that this could include items that where also in sibling pages;
  you should de-duplicate these based on ID.
`;
