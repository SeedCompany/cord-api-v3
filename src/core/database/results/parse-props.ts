import { keyBy, mapValues } from 'lodash';
// eslint-disable-next-line @seedcompany/no-unused-vars -- used in jsdoc below.
import type { matchProps } from '../query';

/**
 * Converts an object `DbProps` to a list of objects from a cypher result.
 *
 * like this: [{ property: string, value: unknown }, ...]
 */
export type PropListDbResult<DbProps extends Record<string, any>> = Array<
  {
    [Key in keyof DbProps]: { property: Key; value: DbProps[Key] };
  }[keyof DbProps]
>;

/**
 * Parses a list of objects from a cypher result to an object.
 * @deprecated Use {@link matchProps} instead which doesn't need this post-transformation
 */
export const parsePropList = <DbProps extends Record<string, any>>(
  propList: PropListDbResult<DbProps>
): DbProps =>
  mapValues(
    keyBy(propList, (p) => p.property),
    (p) => p.value
  ) as DbProps;
