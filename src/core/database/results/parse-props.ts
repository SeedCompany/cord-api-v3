import { keyBy, mapValues } from 'lodash';

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
 */
export const parsePropList = <DbProps extends Record<string, any>>(
  propList: PropListDbResult<DbProps>
): DbProps =>
  mapValues(
    keyBy(propList, (p) => p.property),
    (p) => p.value
  ) as DbProps;
