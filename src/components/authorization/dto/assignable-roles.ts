import { mapValues } from '@seedcompany/common';
import { Calculated, ResourceRelationsShape, Role } from '~/common';
import { RegisterResource } from '~/core/resources';

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
@RegisterResource()
@Calculated()
export class AssignableRoles {
  static Props = [];
  static SecuredProps = [];
  static Relations = mapValues.fromList(Role, () => undefined)
    .asRecord satisfies ResourceRelationsShape;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    AssignableRoles: typeof AssignableRoles;
  }
}
