import { isPlainObject, isString } from 'lodash';
import { CypherExpression, exp } from './cypher-expression';

/**
 * Projects a variable into a different shape.
 *
 * @example
 * mapping('node', ['id', 'createdAt'], { foo: `"bar"` })
 * // outputs: `node { .id, .createdAt, foo: "bar" }`
 *
 * @param variable The variable to project.
 * @param ownTerms The properties of `variable` that are included with this projection.
 * @param entries  Extra key/value pairs to add to this shape.
 * @see https://neo4j.com/docs/cypher-manual/current/syntax/maps/#cypher-map-projection
 */
export function mapping(
  variable: string,
  ownTerms: string[],
  entries?: Record<string, string>
): CypherExpression;

/**
 * Creates a literal map.
 *
 * @example
 * mapping({ foo: `"bar"`, name: 'name.value' })
 * // outputs: `{ foo: "bar", name: name.value }`
 *
 * @param entries The key/value pairs of this mapping.
 * @see https://neo4j.com/docs/cypher-manual/current/syntax/maps/#cypher-literal-maps
 */
export function mapping(entries: Record<string, string>): CypherExpression;

export function mapping(...args: any[]) {
  if (isPlainObject(args[0])) {
    return makeMapping(undefined, [], args[0]);
  }
  if (!isString(args[0])) {
    throw new Error('Invalid signature for mapping()');
  }
  if (Array.isArray(args[1])) {
    return makeMapping(...args);
  }
  throw new Error('Invalid signature for mapping()');
}

function makeMapping(
  variable?: string,
  ownTerms: string[] = [],
  entries: Record<string, string> = {}
) {
  let out = '';
  if (variable) {
    out += variable + ' ';
  }
  const props = [
    ...ownTerms.map((p) => `.${p}`),
    ...Object.entries(entries).map((pair) => pair.join(': ')),
  ];
  out += `{ ${props.join(', ')} }`;
  return exp(out);
}
