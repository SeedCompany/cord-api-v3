import { entries, Nil } from '@seedcompany/common';
import {
  comparisions,
  inArray,
  isNull,
  node,
  not,
  Query,
  regexp,
  relation,
} from 'cypher-query-builder';
import { PatternCollection } from 'cypher-query-builder/dist/typings/clauses/pattern-clause';
import { Comparator } from 'cypher-query-builder/dist/typings/clauses/where-comparators';
import { identity, isFunction } from 'lodash';
import { AbstractClass, ConditionalKeys } from 'type-fest';
import { DateTimeFilter } from '~/common';
import { collect } from './cypher-functions';
import { escapeLuceneSyntax, FullTextIndex } from './full-text';
import { ACTIVE } from './matching';
import { WhereAndList } from './where-and-list';
import { path as pathPattern } from './where-path';

export type Builder<T, K extends keyof T = keyof T> = (
  args: BuilderArgs<T, K>,
) => Query | null | Record<string, any> | void | ((query: Query) => Query);
export interface BuilderArgs<T, K extends keyof T = keyof T> {
  key: K & string;
  value: NonNullable<T[K]>;
  query: Query;
}

export type Builders<T> = {
  [K in keyof Required<T>]: Builder<T, K>;
};

/**
 * A helper to define filters for the given filter class type.
 * Functions can do nothing, adjust the query, return an object to add conditions to
 * the where clause, or return a function which will be called after the where clause.
 */
export const define =
  <T extends Record<string, any>>(
    filterClass: () => AbstractClass<T>,
    builders: Builders<T>,
  ) =>
  (filters: T | Nil) =>
    builder(filters ?? {}, builders);

/**
 * A helper to split filters given and call their respective functions.
 * Functions can do nothing, adjust query, return an object to add conditions to
 * the where clause, or return a function which will be called after the where clause.
 */
export const builder =
  <T extends Record<string, any>>(filters: T, builders: Builders<T>) =>
  (query: Query) => {
    const type = filters.constructor === Object ? null : filters.constructor;
    query.comment(type?.name ?? 'Filters');

    const conditions = [];
    const afters: Array<(query: Query) => Query> = [];
    for (const key of Object.keys(builders)) {
      const value = filters[key];
      if (value == null) {
        continue;
      }
      const res = builders[key]({ value, query, key });
      if (!res || res instanceof Query) {
        continue;
      }
      if (isFunction(res)) {
        afters.push(res);
        continue;
      }
      conditions.push(res);
    }

    if (conditions.length > 0) {
      query.where(new WhereAndList(conditions));
    }
    for (const after of afters) {
      after(query);
    }
  };

export const skip = () => null;

export const isPropNull =
  <T>(prop?: string, negate = false): Builder<T> =>
  ({ key, value, query }) => {
    query.match([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node(prop ?? key, 'Property'),
    ]);
    return {
      [prop ?? key]: {
        value: ((negate ? !value : value) ? not : identity)(isNull()),
      },
    };
  };

export const isPropNotNull = (prop?: string) => isPropNull<any>(prop, true);

export const propVal =
  <T>(prop?: string): Builder<T> =>
  ({ key, value }) => {
    const cond = pathPattern([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node('', 'Property', { value }),
    ]);
    return { [prop ?? key]: cond };
  };

export const propPartialVal =
  <T, K extends ConditionalKeys<Required<T>, string>>(
    prop?: string,
  ): Builder<T, K> =>
  ({ key, value: v, query }) => {
    const value = v as string; // don't know why TS can't figure this out
    if (!value.trim()) {
      return undefined;
    }
    query.match([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node(prop ?? key, 'Property'),
    ]);
    return { [prop ?? key]: { value: regexp(`.*${value}.*`, true) } };
  };

export const stringListProp =
  <T, K extends ConditionalKeys<Required<T>, readonly string[]>>(
    prop?: string,
  ): Builder<T, K> =>
  ({ key, value, query }) => {
    query.match([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node(prop ?? key, 'Property'),
    ]);
    return { [prop ?? key]: { value: inArray(value as any) } };
  };

export const stringListBaseNodeProp =
  <T, K extends ConditionalKeys<Required<T>, readonly string[]>>(
    prop?: string,
  ): Builder<T, K> =>
  ({ key, value }) => ({
    node: { [prop ?? key]: inArray(value as any) },
  });

type PatternInput = Exclude<PatternCollection, any[][]>;

export const pathExists =
  <T, K extends keyof Required<T>>(
    pattern: PatternInput | ((val: NonNullable<T[K]>) => PatternInput),
  ): Builder<T, K> =>
  ({ key, value }) => {
    const cond = pathPattern(isFunction(pattern) ? pattern(value) : pattern);
    return { [key]: value ? cond : not(cond) };
  };

export const pathExistsWhenTrue: typeof pathExists = (pattern) => (args) =>
  args.value ? pathExists(pattern)(args) : null;

export const isPinned = pathExists<{ pinned?: boolean }, 'pinned'>([
  node('requestingUser'),
  relation('out', '', 'pinned'),
  node('node'),
]);

export const dateTimeBaseNodeProp =
  <T, K extends ConditionalKeys<T, DateTimeFilter | undefined>>(
    prop?: string,
  ): Builder<T, K> =>
  ({ key, value }) => {
    const comparison = comparisonOfDateTimeFilter(value);
    return comparison ? { node: { [prop ?? key]: comparison } } : null;
  };

export const dateTimeProp =
  <T, K extends ConditionalKeys<T, DateTimeFilter | undefined>>(
    prop?: string,
  ): Builder<T, K> =>
  ({ key, value, query }) => {
    const comparison = comparisonOfDateTimeFilter(value);
    if (!comparison) {
      return null;
    }
    query.match([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node(prop ?? key, 'Property'),
    ]);
    return { [prop ?? key]: { value: comparison } };
  };

export const comparisonOfDateTimeFilter = (
  input: DateTimeFilter,
): Comparator | undefined => {
  const comparatorMap = {
    afterInclusive: comparisions.greaterEqualTo,
    after: comparisions.greaterThan,
    beforeInclusive: comparisions.lessEqualTo,
    before: comparisions.lessThan,
  };
  const comparators = entries(input).flatMap(([key, val]) =>
    val ? comparatorMap[key](val) : [],
  );
  return comparators.length > 0
    ? (...args) => comparators.map((comp) => comp(...args)).join(' AND ')
    : undefined;
};

export const sub =
  <Input extends Record<string, any>>(
    subBuilder: () => (input: Partial<Input>) => (q: Query) => void,
  ) =>
  <
    // TODO this doesn't enforce Input type on Outer property
    K extends string,
    Outer extends Partial<Record<K, Partial<Input>>>,
  >(
    matchSubNode: (sub: Query) => Query,
  ): Builder<Outer, K> =>
  ({ key, value, query }) =>
    query
      .subQuery('node', (sub) =>
        sub
          .apply(matchSubNode)
          .apply(subBuilder()(value))
          .return(`true as ${key}FiltersApplied`),
      )
      .with('*');

export const fullText =
  ({
    index,
    matchToNode,
  }: {
    index: () => FullTextIndex;
    matchToNode: (query: Query) => Query;
  }) =>
  <T, K extends ConditionalKeys<T, string | undefined>>({
    value: input,
    key: field,
    query,
  }: BuilderArgs<T, K>) => {
    if (!input || typeof input !== 'string') {
      return null;
    }
    const escaped = escapeLuceneSyntax(input);

    const lucene = `*${escaped}*`;

    query
      .subQuery((q) =>
        q
          .call(index().search(lucene, { limit: 100 }).yield({ node: 'match' }))
          .apply(matchToNode)
          .return(collect('distinct node').as(`${field}Matches`)),
      )
      .with('*');

    return { node: inArray(`${field}Matches`, true) };
  };
