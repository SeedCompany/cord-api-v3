import { AbstractClassType } from './types';

const DbSortSymbol = Symbol('DbSortSymbol');

/**
 * A function given a cypher variable will output cypher to transform it for sorting.
 */
type SortTransformer = (value: string) => string;

/**
 * Customize the way this field is sorted upon.
 */
export const DbSort = (transformer: SortTransformer) =>
  Reflect.metadata(DbSortSymbol, transformer);

export const getDbSortTransformer = (
  type: AbstractClassType<unknown>,
  property: string
) => {
  // @ts-expect-error property decoration is on instance of object
  const obj = new type();
  return Reflect.getMetadata(DbSortSymbol, obj, property) as
    | SortTransformer
    | undefined;
};
