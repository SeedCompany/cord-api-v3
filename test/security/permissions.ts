import { DateTime } from 'luxon';
import {
  ID,
  ResourceShape,
  SecuredResource,
  Sensitivity,
  Session,
} from '~/common';
import { ScopedRole } from '../../src/components/authorization';
import {
  AuthorizationService,
  PermissionsOf,
} from '../../src/components/authorization/authorization.service';
import { TestApp } from '../utility';

/**
 * Get the permissions for a resource.
 *
 * @deprecated Use `app.get(Privileges).for().all` instead.
 */
export async function getPermissions<Resource extends ResourceShape<any>>({
  app,
  resource,
  userRole,
  sensitivity,
}: {
  app: TestApp;
  resource: Resource;
  userRole: ScopedRole;
  sensitivity?: Sensitivity;
}): Promise<PermissionsOf<SecuredResource<Resource>>> {
  const session: Session = {
    roles: [userRole],
    token: '',
    issuedAt: DateTime.now(),
    userId: userRole as ID,
    anonymous: false,
  };
  return await app.get(AuthorizationService).getPermissions({
    resource,
    sensitivity,
    sessionOrUserId: session,
  });
}
