import { Field, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type GraphQLScalarType } from 'graphql';
import { lowerCase } from 'lodash';
import { type Class } from 'type-fest';
import { DataObject } from './data-object';
import { IPaginatedList } from './list.interface';
import { type AbstractClassType } from './types';

export interface ListOptions {
  itemsDescription?: string;
}

export interface PaginatedListType<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
}

export function PaginatedList<Type, ListItem = Type>(
  itemClass: Class<Type> | AbstractClassType<Type> | GraphQLScalarType,
  options: ListOptions = {},
) {
  @ObjectType({ isAbstract: true, implements: [IPaginatedList] })
  abstract class PaginatedListClass
    extends DataObject
    implements PaginatedListType<ListItem>, IPaginatedList
  {
    @Field(() => [itemClass], {
      description:
        options.itemsDescription ||
        PaginatedList.itemDescriptionFor(lowerCase(itemClass.name)),
    })
    readonly items: readonly ListItem[];

    @Field(() => Int, {
      description: 'The total number of items across all pages',
    })
    readonly total: number;

    @Field({
      description: 'Whether the next page exists',
    })
    readonly hasMore: boolean;
  }

  return PaginatedListClass;
}

PaginatedList.itemDescriptionFor = (name: string) => stripIndent`
  The page of ${name}.
  Note that this could include items that where also in sibling pages;
  you should de-duplicate these based on ID.
`;
