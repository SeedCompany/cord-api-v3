/**
 * Returns a list containing the values returned by an expression.
 * Using this function aggregates data by amalgamating multiple records or
 * values into a single list.
 *
 * @param expression An expression returning a set of values.
 * @param as         Output as this variable
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-collect
 */
export const collect = (expression: string, as?: string) =>
  `collect(${expression})` + (as ? ' as ' + as : '');

/**
 * Returns the number of values or rows
 *
 * @param expression       The expression
 * @param options          Function options
 * @param options.distinct Whether the expression should be distinct
 * @param options.as       Output as this variable
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-count
 */
export const count = (
  expression: string,
  options: { distinct?: boolean; as?: string }
) =>
  `count(${options.distinct ? 'DISTINCT ' : ''}${expression})` +
  (options.as ? ' as ' + options.as : '');

/**
 * Returns the first non-null value in the given list of expressions.
 *
 * `null` will be returned if all the arguments are `null`.
 *
 * @param expressions An expression which may return null.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-coalesce
 */
export const coalesce = (...expressions: any[]) =>
  `coalesce(${expressions.join(', ')})`;
