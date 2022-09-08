import { keys as keysOf } from 'ts-transformer-keys';
import { mapFromList, ResourceShape } from '~/common';
import { Role } from './role.dto';

/**
 * A special type of object that declares what roles a user can assign to another user.
 *
 * @example Users with role X can assign role Y & Z to any user
 *
 * Policy(Role.X, (r) => [
 *   r.AssignableRoles.specifically((p) => [
 *     p.Y.edit,
 *     p.Z.edit,
 *   ]),
 * ])
 */
export const AssignableRoles = {
  // Stuff actually needed at runtime.
  name: 'AssignableRoles',
  Relations: mapFromList(keysOf<Record<Role, boolean>>(), (role) => [role, '']),
  Props: [],
  SecuredProps: [],
} as unknown as Omit<
  ResourceShape<Record<Role, boolean>>,
  'prototype' | 'Relations'
> & {
  prototype: Record<Role, boolean>;
  Relations: Record<Role, boolean>;
};
