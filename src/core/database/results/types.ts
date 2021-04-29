import type { Node } from 'cypher-query-builder';
import type { DateTime } from 'luxon';
import type { Sensitivity, UnsecuredDto } from '../../../common';
import type { BaseNode } from './parse-base-node';
import type { PropListDbResult } from './parse-props';

/**
 * This converts a DTO to a representation of the properties in the DB.
 * Additional tweaks to the resulting type may be needed.
 *
 * This takes the DTO and:
 * - unwraps the secured props
 * - removes props that are defined in the base node
 * - converts props that are not native DB values
 *   to unknown as they probably need to be handled explicitly.
 *   This allows them to be used for permissions, but not for values.
 */
export type DbPropsOfDto<
  Dto extends Record<string, any>,
  // Specify this as true when using new matchProps query fragment
  IncludeBaseNode extends boolean | undefined = false
> = NativeDbProps<
  Omit<UnsecuredDto<Dto>, IncludeBaseNode extends true ? never : keyof BaseNode>
>;

type NativeDbProps<Dto extends Record<string, any>> = {
  [Key in keyof Dto]: Dto[Key] extends NativeDbValue ? Dto[Key] : unknown;
};

export type NativeDbValue =
  | boolean
  | string
  | number
  | DateTime
  | null
  | string[];

/**
 * This is a shortcut for the standard read result based on the given DB props.
 */
export interface StandardReadResult<DbProps> {
  node: Node<BaseNode>;
  propList: PropListDbResult<DbProps>;
  sensitivity?: Sensitivity;
}
