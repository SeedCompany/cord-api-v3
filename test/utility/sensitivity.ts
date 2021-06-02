import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  createLanguage,
  createLanguageEngagement,
  fragments,
  runAsAdmin,
  TestApp,
} from '.';
import { ID, ResourceShape, SecuredProps, Sensitivity } from '../../src/common';
import { Role } from '../../src/components/authorization';
import { ProjectType } from '../../src/components/project';
import { registerUser } from './register';

export type ReadOneFunction<T extends ResourceShape<any>['prototype']> = (
  app: TestApp,
  id: string
) => Promise<T>;

export type ReadOneRelationArray = (app: TestApp, id: string) => Promise<any[]>;

interface Permission {
  canRead: boolean;
  canEdit: boolean;
}
type PermissionsOf<T> = Record<keyof SecuredProps<T>, Permission>;

export async function expectSensitiveRelationList<
  TResourceStatic extends ResourceShape<any>,
  TResource extends TResourceStatic['prototype']
>({
  app,
  role,
  sensitivityRestriction,
  projectId,
  projectType,
  readFunction,
  resourceId,
  propertyToCheck,
  perms,
}: {
  app: TestApp;
  role: Role;
  sensitivityRestriction: Sensitivity;
  projectId: ID;
  projectType: ProjectType;
  readFunction: ReadOneRelationArray;
  resourceId: ID;
  propertyToCheck: keyof TResource;
  perms: PermissionsOf<TResource>;
}) {
  const email = faker.internet.email();
  const password = faker.internet.password();
  await registerUser(app, {
    roles: [role],
    email: email,
    password: password,
  });

  await runAsAdmin(app, () =>
    doSensitivityLessThanEqualTo(
      sensitivityRestriction,
      projectId,
      app,
      projectType
    )
  );
  const canReadProp = await readFunction(app, resourceId);
  const permProp = propertyToCheck as keyof typeof perms;

  if (perms[permProp]) {
    expect(canReadProp).not.toHaveLength(0);
  }
  if (sensitivityRestriction !== Sensitivity.High) {
    await runAsAdmin(app, () =>
      doSensitivityHigherThan(
        sensitivityRestriction,
        projectId,
        app,
        projectType
      )
    );
    const cannotReadProp = await readFunction(app, resourceId);
    expect(cannotReadProp).toHaveLength(0);
  }
}

export async function expectSensitiveProperty<
  TResourceStatic extends ResourceShape<any>,
  TResource extends TResourceStatic['prototype']
>({
  app,
  role,
  propertyToCheck,
  projectId,
  resourceId,
  sensitivityRestriction,
  readOneFunction,
  permissions,
  projectType,
}: {
  app: TestApp;
  role: Role;
  propertyToCheck: keyof TResource;
  projectId: ID;
  resourceId: string;
  resource: TResourceStatic;
  sensitivityRestriction: Sensitivity;
  permissions: PermissionsOf<TResource>;
  readOneFunction: ReadOneFunction<TResource>;
  projectType: ProjectType;
}) {
  const email = faker.internet.email();
  const password = faker.internet.password();
  await registerUser(app, {
    roles: [role],
    email: email,
    password: password,
  });

  await runAsAdmin(app, () =>
    doSensitivityLessThanEqualTo(
      sensitivityRestriction,
      projectId,
      app,
      projectType
    )
  );

  const canReadProp = await readOneFunction(app, resourceId);
  const permProp = propertyToCheck as keyof typeof permissions;

  if (permissions[permProp]) {
    expect(canReadProp[propertyToCheck].canRead).toEqual(
      permissions[permProp].canRead
    );
    try {
      expect(canReadProp[propertyToCheck].canEdit).toEqual(
        permissions[permProp].canEdit
      );
    } catch (error) {
      if (canReadProp[propertyToCheck].canEdit === undefined) {
        expect(canReadProp[propertyToCheck].canCreate).toEqual(
          permissions[permProp].canEdit
        );
      }
    }
  }

  if (sensitivityRestriction !== Sensitivity.High) {
    await runAsAdmin(app, () =>
      doSensitivityHigherThan(
        sensitivityRestriction,
        projectId,
        app,
        projectType
      )
    );
    const cannotReadProp = await readOneFunction(app, resourceId);
    try {
      expect(cannotReadProp[propertyToCheck].canRead).toBeFalsy();
      expect(cannotReadProp[propertyToCheck].canEdit).toBeFalsy();
    } catch (e) {
      // --- cover for child/grandchild/etc elements, if there's no canRead/canEdit allowed on the element itself,
      //     it's usually a null value.
      //     this means that for child/grandchil/etc elements, canEdit and canRead for that secured element should be
      //     attached along with it.
      if (!cannotReadProp.canRead && !cannotReadProp.canEdit) {
        expect(cannotReadProp.value).toBeUndefined();
      }
      if (canReadProp[propertyToCheck].canEdit === undefined) {
        expect(canReadProp[propertyToCheck].canCreate).toEqual(
          permissions[permProp].canEdit
        );
      }
    }
  }
}
async function doSensitivityHigherThan(
  sensitivity: Sensitivity,
  projectId: ID,
  app: TestApp,
  projectType: ProjectType
): Promise<void> {
  switch (sensitivity) {
    case Sensitivity.Low: {
      if (projectType === ProjectType.Translation) {
        const medSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.Medium,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: medSenslanguage.id,
        });
        const highSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.High,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: highSenslanguage.id,
        });
      } else {
        await updateInternProjectSensitivity(
          app,
          projectId,
          Sensitivity.Medium
        );
      }
      break;
    }
    case Sensitivity.Medium: {
      if (projectType === ProjectType.Translation) {
        const highSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.High,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: highSenslanguage.id,
        });
      } else {
        await updateInternProjectSensitivity(app, projectId, Sensitivity.High);
      }

      break;
    }
    case Sensitivity.High: {
      // nothing higher than High, so just break.
      break;
    }
  }
}
async function doSensitivityLessThanEqualTo(
  sensitivity: Sensitivity,
  projectId: ID,
  app: TestApp,
  projectType: ProjectType
): Promise<void> {
  switch (sensitivity) {
    case Sensitivity.High: {
      if (projectType === ProjectType.Translation) {
        const highSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.High,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: highSenslanguage.id,
        });
      } else {
        await updateInternProjectSensitivity(app, projectId, Sensitivity.High);
      }
    }
    // disabling fallthrough because I for realz want to do it. I want to create High, Med, and Low for the high sensitivity case
    //    keeps me from having to repeat code
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Medium: {
      if (projectType === ProjectType.Translation) {
        const medSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.Medium,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: medSenslanguage.id,
        });
      } else {
        await updateInternProjectSensitivity(
          app,
          projectId,
          Sensitivity.Medium
        );
      }
    }
    // I for realz want to fallthrough, because I want to create medium and low for medium sensitivity
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Low: {
      if (projectType === ProjectType.Translation) {
        const lowSenslanguage = await createLanguage(app, {
          sensitivity: Sensitivity.Low,
        });
        await createLanguageEngagement(app, {
          projectId: projectId,
          languageId: lowSenslanguage.id,
        });
      } else {
        await updateInternProjectSensitivity(app, projectId, Sensitivity.Low);
      }
    }
  }
}

export async function updateInternProjectSensitivity(
  app: TestApp,
  projectId: string,
  sensitivity: Sensitivity
): Promise<void> {
  const result = await app.graphql.query(
    gql`
      mutation updateProject($id: ID!, $sensitivity: Sensitivity!) {
        updateProject(
          input: { project: { id: $id, sensitivity: $sensitivity } }
        ) {
          project {
            ...project
          }
        }
      }
      ${fragments.project}
    `,
    {
      id: projectId,
      sensitivity: sensitivity,
    }
  );
  expect(result.updateProject.project.id).toBe(projectId);
  expect(result.updateProject.project.sensitivity).toBe(sensitivity);
}
