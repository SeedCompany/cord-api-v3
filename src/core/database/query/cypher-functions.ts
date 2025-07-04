import { procedure } from '../query-augmentation/call';
import { exp, type ExpressionInput } from './cypher-expression';
import { IndexFullTextQueryNodes } from './full-text';

/** Create a function with a name that takes a variable number of arguments */
const fn =
  (name: string) =>
  (...args: ExpressionInput[]) =>
    exp(
      `${name}(${args
        .filter((arg) => arg !== undefined)
        .map(exp)
        .join(', ')})`,
    );

/** Create a function with a name that takes a single argument */
const fn1 = (name: string) => (arg: ExpressionInput) => fn(name)(arg);

/** Create a function with a name that takes two arguments */
const fn2 = (name: string) => (arg1: ExpressionInput, arg2: ExpressionInput) =>
  fn(name)(arg1, arg2);

const fn0 = (name: string) => () => fn(name)();

/**
 * Returns a list containing the values returned by an expression.
 * Using this function aggregates data by amalgamating multiple records or
 * values into a single list.
 *
 * @param expression An expression returning a set of values.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-collect
 */
export const collect = fn1('collect');

/**
 * Returns the number of values or rows
 *
 * @param expression       The expression
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-count
 */
export const count = fn1('count');

/**
 * Returns the first non-null value in the given list of expressions.
 *
 * `null` will be returned if all the arguments are `null`.
 *
 * @param expressions An expression which may return null.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/scalar/#functions-coalesce
 */
export const coalesce = fn('coalesce');

export const exists = fn1('exists');

/**
 * Merges maps together.
 * Note: If one expression is given, it is assumed to be a list.
 */
export const merge = (...expressions: ExpressionInput[]) => {
  if (expressions.length === 2) {
    return fn('apoc.map.merge')(...expressions);
  }
  if (expressions.length === 1) {
    return fn('apoc.map.mergeList')(expressions[0]);
  }
  return fn('apoc.map.mergeList')(expressions);
};

export const randomUUID = fn0('randomUUID');

export const apoc = {
  map: {
    /**
     * Creates an object/map from input list.
     * @example
     * fromValues([key1, value1, key2, value2, ...])
     */
    fromValues: fn1('apoc.map.fromValues'),
    merge,
    submap: fn('apoc.map.submap'),
  },
  coll: {
    flatten: fn1('apoc.coll.flatten'),
    indexOf: fn('apoc.coll.indexOf'),
    /**
     * Returns the items in the first list that aren't in the second list.
     * @see https://neo4j.com/docs/apoc/current/overview/apoc.coll/apoc.coll.disjunction/
     */
    disjunction: fn2('apoc.coll.disjunction'),
    /**
     * Returns the distinct union of the two given LIST<ANY> values.
     * @see https://neo4j.com/docs/apoc/current/overview/apoc.coll/apoc.coll.union/
     */
    union: fn2('apoc.coll.union'),
  },
  convert: {
    /** Converts Neo4j node to object/map of the node's properties */
    toMap: fn1('apoc.convert.toMap'),
    toJson: fn1('apoc.convert.toJson'),
    fromJsonList: fn1('apoc.convert.fromJsonList'),
    fromJsonMap: fn1('apoc.convert.fromJsonMap'),
  },
  create: {
    uuid: randomUUID,
    setLabels: (node: ExpressionInput, labels: readonly string[]) =>
      procedure('apoc.create.setLabels', ['node'])({ node: exp(node), labels }),
  },
  text: {
    /**
     * @see https://neo4j.com/docs/apoc/current/overview/apoc.text/apoc.text.join/
     */
    join: (list: ExpressionInput, delimiter: string) =>
      fn('apoc.text.join')(list, delimiter),
  },
};

export const cleanTextList = (list: ExpressionInput) =>
  exp(`[x IN ${exp(list)} WHERE x IS NOT NULL AND trim(x) <> '' | trim(x)]`);

export const textJoinMaybe = (items: ExpressionInput, delimiter = ' ') => {
  const cleaned = cleanTextList(items);
  return exp(
    `CASE WHEN size(${cleaned}) = 0 THEN null ELSE ${apoc.text.join(
      `${cleaned}`,
      `"${delimiter}"`,
    )} END`,
  );
};

/**
 * Joins each expression given with a `+` character.
 */
export const listConcat = (...items: ExpressionInput[]) =>
  exp(
    items
      .filter((item) => item !== undefined)
      .map(exp)
      .join(' + '),
  );

/**
 * @see https://neo4j.com/docs/cypher-manual/current/functions/list/#functions-reduce
 */
export const reduce = (
  accumulator: string,
  initial: ExpressionInput,
  list: ExpressionInput,
  variable: string,
  iteratee: ExpressionInput,
) =>
  fn('reduce')(
    `${exp(accumulator)} = ${exp(initial)}`,
    `${variable} IN ${exp(list)} | ${exp(iteratee)}`,
  );

/**
 * @see https://neo4j.com/docs/cypher-manual/current/functions/predicate/#functions-any
 */
export const any = (
  variable: string,
  list: ExpressionInput,
  predicate: ExpressionInput,
) => fn('any')(`${variable} IN ${exp(list)} WHERE ${exp(predicate)}`);

export const db = {
  index: {
    fulltext: {
      queryNodes: IndexFullTextQueryNodes,
    },
  },
};
