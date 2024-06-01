import { entries } from '@seedcompany/common';
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
  input: Sort<Field> & SortInternals,
) => {
  const { transformer, matcher, sort, order } = config(input);

  const transformerRef = input.transformerRef ?? { current: transformer };

  const subInput = { sort, order, sub: true, transformerRef };
  if (input.sub) {
    transformerRef.current = transformer;
    return (query: Query) => matcher(query, subInput);
  }

  return (query: Query) =>
    query.comment`sorting(${input.sort})`
      .subQuery('*', (sub) => matcher(sub, subInput))
      .with('*')
      .orderBy(`${transformerRef.current('sortValue')}`, order);
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
 *
 *   // The ability to nest sorting into relationships is possible.
 *   // This is done by appending `.*` to the key.
 *   // For example, the sort field could be "parent.name"
 *   'parent.*': (query, input) => query
 *     // Again match as needed
 *     .match(...)
 *     // Call sortWith with the sorters of the relationship type.
 *     // These matchers are also given the current sort _input_
 *     // (second arg above) which can be passed down like this.
 *     // `sortWith` understands this nesting and will remove the `parent.`
 *     // prefix before matching the nested sorters.
 *     .apply(sortWith(userSorters, input))
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

    const [matchedPrefix, subCustom] = entries(matchers).find(
      ([key]) => key.endsWith('.*') && sort.startsWith(key.slice(0, -1)),
    ) ?? [null, null];
    if (matchedPrefix && subCustom) {
      const subField = sort.slice(matchedPrefix.length - 1);
      return { ...common, matcher: subCustom, sort: subField };
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
  input: Sort<Field> & SortInternals,
) => Query<SortCol>;

type SortMatchers<Field extends string> = Partial<
  Record<Field, SortMatcher<Field>>
>;

interface Sort<Field extends string> {
  sort: Field;
  order: Order;
}

interface SortInternals {
  /** @internal */
  sub?: boolean;
  /** @internal */
  transformerRef?: { current: SortTransformer };
}

interface SortMatch<SortKey extends string> {
  matcher: SortMatcher<SortKey>;
  transformer: SortTransformer;
}
