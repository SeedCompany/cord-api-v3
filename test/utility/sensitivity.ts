import { gql } from 'apollo-server-core';
import {
  createLanguage,
  createLanguageEngagement,
  fragments,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '.';
import {
  AbstractClassType,
  ArrayItem,
  ID,
  ResourceShape,
  Secured,
  SecuredResource,
  Sensitivity,
} from '../../src/common';
import { Role } from '../../src/components/authorization';
import { Permission } from '../../src/components/authorization/authorization.service';
import { ProjectType } from '../../src/components/project';
import { registerUser } from './register';

export type ReadOneFunction<T extends ResourceShape<any>['prototype']> = (
  app: TestApp,
  id: string
) => Promise<T>;

type InstanceOf<T> = T extends ResourceShape<any> ? T['prototype'] : never;

export type ResourceArrayRelation<
  TResourceStatic extends ResourceShape<any>,
  Rel extends keyof TResourceStatic['Relations'] & string
> = InstanceOf<ArrayItem<TResourceStatic['Relations'][Rel]>>;

export async function expectSensitiveRelationList<
  TResourceStatic extends ResourceShape<any>,
  Prop extends keyof TResourceStatic['Relations'] & string
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
  resource: TResourceStatic;
  role: Role;
  sensitivityRestriction: Sensitivity;
  projectId: ID;
  projectType: ProjectType;
  readFunction: ReadOneFunction<
    ReadonlyArray<ResourceArrayRelation<TResourceStatic, Prop>>
  >;
  resourceId: ID;
  propertyToCheck: Prop;
  perms: Record<Prop, Permission>;
}) {
  const user = await runInIsolatedSession(app, () =>
    registerUser(app, { roles: [role] })
  );

  await runAsAdmin(app, () =>
    doSensitivityLessThanEqualTo(
      sensitivityRestriction,
      projectId,
      app,
      projectType
    )
  );
  const canReadProp = await user.runAs(() => readFunction(app, resourceId));

  if (perms[propertyToCheck]) {
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
    const cannotReadProp = await user.runAs(() =>
      readFunction(app, resourceId)
    );
    expect(cannotReadProp).toHaveLength(0);
  }
}

export async function expectSensitiveProperty<
  TResourceStatic extends ResourceShape<any>,
  TResource extends SecuredResource<TResourceStatic>,
  Prop extends keyof TResource & string
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
  propertyToCheck: Prop;
  projectId: ID;
  resourceId: string;
  resource: TResourceStatic;
  sensitivityRestriction: Sensitivity;
  permissions: Record<Prop, Permission>;
  readOneFunction: ReadOneFunction<
    Record<
      Prop,
      TResource[Prop] extends AbstractClassType<any>
        ? Secured<TResource[Prop]['prototype']>
        : TResource[Prop]
    >
  >;
  projectType: ProjectType;
}) {
  const user = await runInIsolatedSession(app, () =>
    registerUser(app, { roles: [role] })
  );

  await runAsAdmin(app, () =>
    doSensitivityLessThanEqualTo(
      sensitivityRestriction,
      projectId,
      app,
      projectType
    )
  );

  const canReadProp = await user.runAs(() => readOneFunction(app, resourceId));

  if (permissions[propertyToCheck]) {
    expect(canReadProp[propertyToCheck].canRead).toEqual(
      permissions[propertyToCheck].canRead
    );
    try {
      expect(canReadProp[propertyToCheck].canEdit).toEqual(
        permissions[propertyToCheck].canEdit
      );
    } catch (error) {
      if (canReadProp[propertyToCheck].canEdit === undefined) {
        expect(canReadProp[propertyToCheck].canCreate).toEqual(
          permissions[propertyToCheck].canEdit
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

    const cannotReadProp = await user.runAs(() =>
      readOneFunction(app, resourceId)
    );

    if (cannotReadProp[propertyToCheck].canRead != null) {
      expect(cannotReadProp[propertyToCheck].canRead).toBeFalsy();
      expect(cannotReadProp[propertyToCheck].canEdit).toBeFalsy();
    } else {
      // --- cover for child/grandchild/etc elements, if there's no canRead/canEdit allowed on the element itself,
      //     it's usually a null value.
      //     this means that for child/grandchil/etc elements, canEdit and canRead for that secured element should be
      //     attached along with it.
      const prop = cannotReadProp as unknown as Secured<unknown>;
      if (!prop.canRead && !prop.canEdit) {
        expect(prop.value).toBeUndefined();
      }
      if (canReadProp[propertyToCheck].canEdit === undefined) {
        expect(canReadProp[propertyToCheck].canCreate).toEqual(
          permissions[propertyToCheck].canEdit
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
