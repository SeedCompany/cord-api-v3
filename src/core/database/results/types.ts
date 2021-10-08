import type { DateTime } from 'luxon';
import { Resource } from '../../../common';
import type { UnsecuredDto } from '../../../common';
import type { BaseNode } from './parse-base-node';

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
  Omit<
    UnsecuredDto<Dto>,
    IncludeBaseNode extends true ? never : keyof BaseNode['properties']
  >
> &
  Pick<Resource, 'scope'>;

export type NativeDbProps<Dto extends Record<string, any>> = {
  [Key in keyof Dto]: Dto[Key] extends NativeDbValue ? Dto[Key] : unknown;
};

export type NativeDbValue =
  | boolean
  | string
  | number
  | DateTime
  | null
  | readonly string[];
