import { node, Query, relation } from 'cypher-query-builder';
import { identity } from 'rxjs';
import {
  getDbSortTransformer,
  MadeEnum,
  Order,
  Resource,
  ResourceShape,
} from '~/common';
import { apoc } from './cypher-functions';
import { ACTIVE } from './matching';

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
 * Optionally custom property matchers can be passed in that override the
 * default property matching queries.
 * These are given a query and are expected to have a return clause with a `sortValue`
 */
export const sorting =
  <TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic,
    { sort, order }: { sort: string; order: Order },
    customPropMatchers: {
      [SortKey in string]?: (query: Query) => Query<{ sortValue: unknown }>;
    } = {},
  ) =>
  (query: Query) => {
    const sortTransformer = getDbSortTransformer(resource, sort) ?? identity;

    const baseNodeProps = resource.BaseNodeProps ?? Resource.Props;
    const isBaseNodeProp = baseNodeProps.includes(sort);

    const matcher =
      customPropMatchers[sort] ??
      (isBaseNodeProp ? matchBasePropSort : matchPropSort)(sort);

    return query.comment`sorting(${sort})`
      .subQuery('*', matcher)
      .with('*')
      .orderBy(`${sortTransformer('sortValue')}`, order);
  };

const matchPropSort = (prop: string) => (query: Query) =>
  query
    .match([
      node('node'),
      relation('out', '', prop, ACTIVE),
      node('sortProp', 'Property'),
    ])
    .return('sortProp.value as sortValue');

const matchBasePropSort = (prop: string) => (query: Query) =>
  query.return(`node.${prop} as sortValue`);
