import { exp } from './cypher-expression';

/**
 * Returns a list containing the values returned by an expression.
 * Using this function aggregates data by amalgamating multiple records or
 * values into a single list.
 *
 * @param expression An expression returning a set of values.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-collect
 */
export const collect = (expression: string) => exp(`collect(${expression})`);

/**
 * Returns the number of values or rows
 *
 * @param expression       The expression
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-count
 */
export const count = (expression: string) => exp(`count(${expression})`);

/**
 * Returns the first non-null value in the given list of expressions.
 *
 * `null` will be returned if all the arguments are `null`.
 *
 * @param expressions An expression which may return null.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/scalar/#functions-coalesce
 */
export const coalesce = (...expressions: any[]) =>
  exp(`coalesce(${expressions.join(', ')})`);
