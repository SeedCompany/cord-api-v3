import { registerUser, runInIsolatedSession, TestApp } from '.';
import { ResourceShape } from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { getPermissions } from '../security/permissions';
import { ReadOneFunction } from './sensitivity';

export async function testRole<
  Resource extends ResourceShape<any>,
  ResourceObj extends Resource['prototype']
>({
  app,
  resource,
  staticResource,
  role,
  readOneFunction,
  propToTest,
  skipEditCheck = false,
  isSecureList = false,
}: {
  app: TestApp;
  resource: ResourceObj;
  staticResource: Resource;
  role: Role;
  readOneFunction: ReadOneFunction<ResourceObj>;
  propToTest: keyof ResourceObj;
  skipEditCheck?: boolean;
  isSecureList?: boolean;
}): Promise<void> {
  const permissions = (await getPermissions({
    app,
    resource: staticResource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: resource.sensitivity,
  })) as Partial<ResourceObj>;
  const readResource = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [role] });
    return await readOneFunction(app, resource.id);
  });
  expect(readResource[propToTest].canRead).toEqual(
    permissions[propToTest].canRead
  );

  if (isSecureList) {
    if (!skipEditCheck) {
      expect(readResource[propToTest].canCreate).toEqual(
        permissions[propToTest].canEdit
      );
    }
  } else if (!skipEditCheck) {
    expect(readResource[propToTest].canEdit).toEqual(
      permissions[propToTest].canEdit
    );
  }
}
