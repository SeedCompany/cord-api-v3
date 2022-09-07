import { keys as keysOf } from 'ts-transformer-keys';
import { ResourceShape } from '~/common';
import { Role } from './role.dto';

/**
 * A special type of object that declares what roles a user can assign to another user.
 *
 * @example Users with role X can assign role Y & Z to any user
 *
 * Policy(Role.X, (r) => [
 *   r.AssignableRoles.specifically((p) => [
 *     p.Y.write,
 *     p.Z.write,
 *   ]),
 * ])
 */
export const AssignableRoles = {
  // Stuff actually needed at runtime.
  name: 'AssignableRoles',
  Props: keysOf<Record<Role, boolean>>(),
  SecuredProps: [],
} as unknown as Omit<ResourceShape<Record<Role, boolean>>, 'prototype'> & {
  prototype: Record<Role, boolean>;
};
