import * as faker from 'faker';
import { property } from 'lodash';
import {
  createLanguage,
  createLanguageEngagement,
  runAsAdmin,
  TestApp,
} from '.';
import { ID, ResourceShape, Sensitivity } from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { getPermissions } from '../security/permissions';
import { registerUser } from './register';

type ReadOneFunction<T extends ResourceShape<any>['prototype']> = (
  app: TestApp,
  id: string
) => Promise<T>;

export async function expectSensitivePropertyTranslationProject<
  TResourceStatic extends ResourceShape<any>,
  TResource extends TResourceStatic['prototype']
>({
  app,
  role,
  propertyToCheck,
  projectId,
  resourceId,
  resource,
  sensitivityRestriction,
  readOneFunction,
}: {
  app: TestApp;
  role: Role;
  propertyToCheck: keyof TResource;
  projectId: ID;
  resourceId: string;
  resource: TResourceStatic;
  sensitivityRestriction: Sensitivity;
  readOneFunction: ReadOneFunction<TResource>;
}) {
  const email = faker.internet.email();
  const password = faker.internet.password();
  const testUser = await registerUser(app, {
    roles: [role],
    email: email,
    password: password,
  });

  console.log('initial read');
  const resourceObj = await readOneFunction(app, resourceId);
  const perms = (await getPermissions({
    resource: resource,
    sessionOrUserId: testUser.id,
    userRole: `global:${role}` as ScopedRole,
    dto: resourceObj,
  })) as Partial<TResource>;

  await runAsAdmin(app, () =>
    doSensitivityLessThanEqualTo(sensitivityRestriction, projectId, app)
  );

  console.log('Can read');
  const canReadProp = await readOneFunction(app, resourceId);

  if (perms[propertyToCheck]) {
    expect(canReadProp[propertyToCheck].canRead).toEqual(
      perms[propertyToCheck].canRead
    );
    expect(canReadProp[propertyToCheck].canEdit).toEqual(
      perms[propertyToCheck].canEdit
    );
  }

  if (sensitivityRestriction !== Sensitivity.High) {
    await runAsAdmin(app, () =>
      doSensitivityHigherThan(sensitivityRestriction, projectId, app)
    );
    console.log('higher sensitivity');
    const cannotReadProp = await readOneFunction(app, resourceId);
    expect(cannotReadProp[propertyToCheck].canRead).toBeFalsy();
    expect(cannotReadProp[propertyToCheck].canEdit).toBeFalsy();
  }
}
async function doSensitivityHigherThan(
  sensitivity: Sensitivity,
  projectId: ID,
  app: TestApp
): Promise<void> {
  switch (sensitivity) {
    case Sensitivity.Low: {
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
      break;
    }
    case Sensitivity.Medium: {
      const highSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.High,
      });
      await createLanguageEngagement(app, {
        projectId: projectId,
        languageId: highSenslanguage.id,
      });
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
  app: TestApp
): Promise<void> {
  switch (sensitivity) {
    case Sensitivity.High: {
      const highSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.High,
      });
      await createLanguageEngagement(app, {
        projectId: projectId,
        languageId: highSenslanguage.id,
      });
    }
    // disabling fallthrough because I for realz want to do it. I want to create High, Med, and Low for the high sensitivity case
    //    keeps me from having to repeat code
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Medium: {
      const medSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.Medium,
      });
      await createLanguageEngagement(app, {
        projectId: projectId,
        languageId: medSenslanguage.id,
      });
    }
    // I for realz want to fallthrough, because I want to create medium and low for medium sensitivity
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Low: {
      const lowSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.Low,
      });
      await createLanguageEngagement(app, {
        projectId: projectId,
        languageId: lowSenslanguage.id,
      });
    }
  }
}
