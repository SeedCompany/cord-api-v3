import { stripIndent } from 'common-tags';
import { ClassType, Field, Int, ObjectType } from 'type-graphql';

// tslint:disable-next-line:ban-types
type AbstractClassType<T> = Function & { prototype: T };

export function PaginatedList<T>(
  ItemClass: ClassType<T> | AbstractClassType<T>,
) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedListClass {
    @Field(() => [ItemClass], {
      description: stripIndent`
        The page of ${ItemClass.name.toLowerCase()}.
        Note that this could include items that where also in sibling pages;
        you should de-duplicate these based on ID.
      `,
    })
    readonly items: readonly T[];

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
