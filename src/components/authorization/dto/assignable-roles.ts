import { keys as keysOf } from 'ts-transformer-keys';
import { mapFromList } from '~/common';
import { Role } from './role.dto';

/**
 * A special type of object that declares what roles a user can assign to another user.
 *
 * @example Users with role X can assign role Y & Z to any user
 *
 * Policy(Role.X, (r) => [
 *   Role.assignable(r, [
 *     Role.Y,
 *     Role.Z,
 *   ])
 * ])
 */
export class AssignableRoles {
  static Props = [];
  static SecuredProps = [];
  static Relations = mapFromList(keysOf<Record<Role, boolean>>(), (role) => [
    role,
    undefined,
  ]);
}
