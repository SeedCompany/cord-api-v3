import * as faker from 'faker';
import {
  createLanguage,
  createLanguageEngagement,
  runAsAdmin,
  TestApp,
} from '.';
import { ResourceShape, Sensitivity } from '../../src/common';
import { Role } from '../../src/components/authorization';
import { registerUser } from './register';

type ReadOneFunction<T extends ResourceShape<any>['prototype']> = (
  app: TestApp,
  id: string
) => Promise<T>;

export async function checkSensitivePropertyTranslation<
  TObject extends ResourceShape<any>['prototype']
>(
  app: TestApp,
  role: Role,
  propertyToCheck: keyof TObject,
  projectId: string,
  resourceId: string,
  resource: TObject,
  sensitivityRestriction: Sensitivity,
  readOneFunction: ReadOneFunction<TObject>
) {
  await doSensitivityLessThanEqualTo(sensitivityRestriction, projectId, app);
  const email = faker.internet.email();
  const password = faker.internet.password();
  await registerUser(app, {
    roles: [role],
    email: email,
    password: password,
  });
  const canReadProp = await readOneFunction(app, resourceId);
  expect(canReadProp[propertyToCheck]).toEqual(resource[propertyToCheck]);

  if (sensitivityRestriction !== Sensitivity.High) {
    await runAsAdmin(app, () =>
      doSensitivityHigherThan(sensitivityRestriction, projectId, app)
    );
    const cannotReadProp = await readOneFunction(app, resourceId);
    expect(cannotReadProp[propertyToCheck]).toBeFalsy();
  }
}
async function doSensitivityHigherThan(
  sensitivity: Sensitivity,
  projectId: string,
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
  projectId: string,
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
