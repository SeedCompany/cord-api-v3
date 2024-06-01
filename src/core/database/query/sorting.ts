import { node, Query, relation } from 'cypher-query-builder';
import { identity } from 'rxjs';
import { LiteralUnion } from 'type-fest';
import { MadeEnum, Order, Resource, ResourceShape } from '~/common';
import {
  getDbSortTransformer,
  SortTransformer,
} from '~/common/db-sort.decorator';
import { apoc } from './cypher-functions';
import { ACTIVE } from './matching';

/**
 * Declares a that an enum field, is to be sorted by the index of the enum members.
 *
 * @example
 * ```ts
 * @DbSort(sortingForEnumIndex(Status)
 * status: Status
 * ```
 */
export const sortingForEnumIndex =
  <T extends string>(theEnum: MadeEnum<T>) =>
  (variable: string) =>
    apoc.coll.indexOf(
      [...theEnum.values].map((v) => `"${v}"`),
      variable,
    );

/**
 * Applies sorting to rows given the input.
 *
 * Optionally, custom property matchers can be passed in to override the
 * default property matching queries.
 * These are given a query and are expected to have a return clause with a `sortValue`
 *
 * @example
 * query.apply(sorting(User, input))
 */
export const sorting = <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  input: Sort<SortFieldOf<TResourceStatic>>,
  matchers: SortMatchers<SortFieldOf<TResourceStatic>> = {},
) => sortWith(defineSorters(resource, matchers), input);

/**
 * Applies sorting to rows given the sorters & input.
 *
 * @example
 * query.apply(sortWith(userSorters, input))
 */
export const sortWith = <Field extends string>(
  config: (input: Sort<Field>) => Sort<Field> & SortMatch<Field>,
  input: Sort<Field>,
) => {
  const { transformer, matcher, order } = config(input);

  return (query: Query) =>
    query.comment`sorting(${input.sort})`
      .subQuery('*', (sub) => matcher(sub, input))
      .with('*')
      .orderBy(`${transformer('sortValue')}`, order);
};

/**
 * Declares sorters for the given type.
 *
 * ```ts
 * const userSorters = defineSorters(User, {
 *   // The key is the sort field string that callers can pick
 *   // This is a loose string, so it can be an existing field
 *   // on the type or something completely new.
 *   name: (query) => query
 *     // Do whatever to calculate the sort value.
 *     // `node` can be assumed to be the current type.
 *     // One per row.
 *     .match(...)
 *     // This "matcher" function should end with a return clause that
 *     // emits `sortValue`
 *     .return<SortCol>('x as sortValue')
 * });
 * ```
 */
export const defineSorters =
  <TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic,
    matchers: SortMatchers<SortFieldOf<TResourceStatic>>,
  ) =>
  ({ sort, order }: Sort<SortFieldOf<TResourceStatic>>) => {
    const transformer = getDbSortTransformer(resource, sort) ?? identity;
    const common = { sort, order, transformer };

    const exactCustom = matchers[sort];
    if (exactCustom) {
      return { ...common, matcher: exactCustom };
    }

    const baseNodeProps = resource.BaseNodeProps ?? Resource.Props;
    const isBaseNodeProp = baseNodeProps.includes(sort);
    const matcher = (isBaseNodeProp ? matchBasePropSort : matchPropSort)(sort);
    return { ...common, matcher };
  };

const matchPropSort = (prop: string) => (query: Query) =>
  query
    .match([
      node('node'),
      relation('out', '', prop, ACTIVE),
      node('sortProp', 'Property'),
    ])
    .return<SortCol>('sortProp.value as sortValue');

const matchBasePropSort = (prop: string) => (query: Query) =>
  query.return<SortCol>(`node.${prop} as sortValue`);

export interface SortCol {
  sortValue: unknown;
}

// TODO stricter
type SortFieldOf<TResourceStatic extends ResourceShape<any>> = LiteralUnion<
  keyof TResourceStatic['prototype'] & string,
  string
>;

type SortMatcher<Field extends string> = (
  query: Query,
  input: Sort<Field>,
) => Query<SortCol>;

type SortMatchers<Field extends string> = Partial<
  Record<Field, SortMatcher<Field>>
>;

interface Sort<Field extends string> {
  sort: Field;
  order: Order;
}

interface SortMatch<SortKey extends string> {
  matcher: SortMatcher<SortKey>;
  transformer: SortTransformer;
}
