import { exp, ExpressionInput } from './cypher-expression';

/** Create a function with a name that takes a variable number of arguments */
const fn =
  (name: string) =>
  (...args: ExpressionInput[]) =>
    exp(
      `${name}(${args
        .filter((arg) => arg !== undefined)
        .map(exp)
        .join(', ')})`
    );

/** Create a function with a name that takes a single argument */
const fn1 = (name: string) => (arg: ExpressionInput) => fn(name)(arg);

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
