import { Field, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { GraphQLScalarType } from 'graphql';
import { Class } from 'type-fest';
import { AbstractClassType } from './types';

export interface ListOptions {
  itemsDescription?: string;
}

export function PaginatedList<Type, ListItem = Type>(
  itemClass: Class<Type> | AbstractClassType<Type> | GraphQLScalarType,
  options: ListOptions = {}
) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedListClass {
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
    })
    readonly hasMore: boolean;

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
