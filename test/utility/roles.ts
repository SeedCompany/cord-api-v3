import { TestApp } from '.';
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
}: {
  app: TestApp;
  resource: ResourceObj;
  staticResource: Resource;
  role: Role;
  readOneFunction: ReadOneFunction<ResourceObj>;
  propToTest: keyof ResourceObj;
  skipEditCheck: boolean;
}): Promise<void> {
  const permissions = (await getPermissions({
    resource: staticResource,
    userRole: `global:${role}` as ScopedRole,
    sensitivity: resource.sensitivity,
  })) as Partial<ResourceObj>;
  const readResource = await readOneFunction(app, resource.id);
  expect(readResource[propToTest].canRead).toEqual(
    permissions[propToTest].canRead
  );
  // try {
  if (!skipEditCheck) {
    expect(readResource[propToTest].canEdit).toEqual(
      permissions[propToTest].canEdit
    );
  }

  // } catch (e) {
  //   // covers for lists of items that has canCreate instead of canEdit
  //   expect(readResource[propToTest].canEdit).toEqual(
  //     permissions[propToTest].canCreate
  //   );
  // }
}
