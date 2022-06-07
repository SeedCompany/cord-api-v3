import {
  between,
  greaterEqualTo,
  inArray,
  isNull,
  lessEqualTo,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { PatternCollection } from 'cypher-query-builder/dist/typings/clauses/pattern-clause';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { identity, isFunction } from 'lodash';
import { ConditionalKeys } from 'type-fest';
import { DateTimeFilter } from '../../../common';
import { ACTIVE } from './matching';
import { path as pathPattern } from './where-path';

export type Builder<T, K extends keyof T = keyof T> = (
  args: BuilderArgs<T, K>
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
 * A helper to split filters given and call their respective functions.
 * Functions can do nothing, adjust query, return an object to add conditions to
 * the where clause, or return a function which will be called after the where clause.
 */
export const builder =
  <T extends Record<string, any>>(filters: T, builders: Builders<T>) =>
  (query: Query) => {
    const type = filters.constructor === Object ? null : filters.constructor;
    query.comment(type?.name ?? 'Filters');

    let conditions: AndConditions = {};
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
      conditions = { ...conditions, ...res };
    }

    if (Object.keys(conditions).length > 0) {
      query.where(conditions);
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

export const stringListProp =
  <T, K extends ConditionalKeys<Required<T>, readonly string[]>>(
    prop?: string
  ): Builder<T, K> =>
  ({ key, value, query }) => {
    query.match([
      node('node'),
      relation('out', '', prop ?? key, ACTIVE),
      node(prop ?? key, 'Property'),
    ]);
    return { [prop ?? key]: { value: inArray(value as any) } };
  };

type PatternInput = Exclude<PatternCollection, any[][]>;

export const pathExists =
  <T, K extends keyof Required<T>>(
    pattern: PatternInput | ((val: NonNullable<T[K]>) => PatternInput)
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
  <T, K extends ConditionalKeys<Required<T>, DateTimeFilter>>(
    prop?: string
  ): Builder<T, K> =>
  ({ key, value }) => {
    const comparison = comparisonOfDateTimeFilter(value);
    return comparison ? { node: { [prop ?? key]: comparison } } : null;
  };

export const dateTimeProp =
  <T, K extends ConditionalKeys<Required<T>, DateTimeFilter>>(
    prop?: string
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

const comparisonOfDateTimeFilter = ({ after, before }: DateTimeFilter) =>
  after && before
    ? between(after, before)
    : after
    ? greaterEqualTo(after)
    : before
    ? lessEqualTo(before)
    : undefined;
