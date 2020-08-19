import type { Node } from 'cypher-query-builder';
import type { DateTime } from 'luxon';
import type { ConditionalPick, Except } from 'type-fest';
import type { UnsecuredDto } from '../../../common';
import type { BaseNode } from './parse-base-node';
import type { PermListDbResult } from './parse-permissions';
import type { PropListDbResult } from './parse-props';

/**
 * This converts a DTO to a representation of the properties in the DB.
 * Additional tweaks to the resulting type may be needed.
 *
 * This takes the DTO and:
 * - unwraps the secured props
 * - removes props that are defined in the base node
 * - removes props that are not "simple" values
 *   as they probably need to be handled explicitly
 */
export type DbPropsOfDto<Dto extends Record<string, any>> = ConditionalPick<
  Except<UnsecuredDto<Dto>, keyof BaseNode>,
  boolean | string | number | DateTime | null | string[]
>;

/**
 * This is a shortcut for the standard read result based on the given DB props.
 */
export interface StandardReadResult<DbProps> {
  node: Node<BaseNode>;
  propList: PropListDbResult<DbProps>;
  permList: PermListDbResult<DbProps>;
}
