import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import {
  ResourceShape,
  SecuredProps,
  SecuredResource,
  Sensitivity,
} from '../../src/common';
import { PermissionsOf } from '../../src/components/authorization/authorization.service';
import { Powers } from '../../src/components/authorization/dto/powers';
import {
  EthnologueLanguage,
  Language,
} from '../../src/components/language/dto';
import { Location } from '../../src/components/location';
import { Role } from '../../src/components/project';
import {
  addLocationToLanguage,
  createLanguage,
  createLocation,
  createSession,
  createTestApp,
  login,
  readOneLanguage,
  readOneLanguageEthnologue,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
import { ReadOneFunction } from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Language Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;
  let testLanguage: Language;
  let testLocation: Location;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateLanguage,
        Powers.CreateLocation,
        Powers.CreateEthnologueLanguage,
      ],
      { email: email, password: password }
    );
    testLocation = await createLocation(app);
    testLanguage = await createLanguage(app);
    await addLocationToLanguage(app, testLocation.id, testLanguage.id);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  describe('Restricted by role', () => {
    describe.each`
      role
      ${Role.Administrator}
      ${Role.Consultant}
      ${Role.ConsultantManager}
      ${Role.Controller}
      ${Role.FieldOperationsDirector}
      ${Role.FinancialAnalyst}
      ${Role.Fundraising}
      ${Role.Intern}
      ${Role.LeadFinancialAnalyst}
      ${Role.Leadership}
      ${Role.Liaison}
      ${Role.Marketing}
      ${Role.Mentor}
      ${Role.ProjectManager}
      ${Role.RegionalCommunicationsCoordinator}
    `('Global $role', ({ role }) => {
      test.each`
        property                       | readFunction       | staticResource
        ${'displayName'}               | ${readOneLanguage} | ${Language}
        ${'displayNamePronunciation'}  | ${readOneLanguage} | ${Language}
        ${'isDialect'}                 | ${readOneLanguage} | ${Language}
        ${'isSignLanguage'}            | ${readOneLanguage} | ${Language}
        ${'leastOfThese'}              | ${readOneLanguage} | ${Language}
        ${'name'}                      | ${readOneLanguage} | ${Language}
        ${'leastOfTheseReason'}        | ${readOneLanguage} | ${Language}
        ${'populationOverride'}        | ${readOneLanguage} | ${Language}
        ${'registryOfDialectsCode'}    | ${readOneLanguage} | ${Language}
        ${'signLanguageCode'}          | ${readOneLanguage} | ${Language}
        ${'sponsorEstimatedEndDate'}   | ${readOneLanguage} | ${Language}
        ${'hasExternalFirstScripture'} | ${readOneLanguage} | ${Language}
        ${'tags'}                      | ${readOneLanguage} | ${Language}
      `(
        ' reading $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testLanguage,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
          });
        }
      );
    });
  });
  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property                    | resource              | readFunction
          ${'registryOfDialectsCode'} | ${Language}           | ${readOneLanguage}
          ${'signLanguageCode'}       | ${Language}           | ${readOneLanguage}
          ${'code'}                   | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'name'}                   | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'population'}             | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
          ${'provisionalCode'}        | ${EthnologueLanguage} | ${readOneLanguageEthnologue}
        `(
          ' reading $property',
          async ({ property, resource, readFunction }) => {
            await login(app, { email: email, password: password });
            const perms = await getPermissions({
              resource: resource,
              userRole: role,
            });
            // await testSensitivityLowerThanEqualTo(
            //   app,
            //   sensitivityToTest,
            //   property as keyof SecuredProps<Language>,
            //   perms
            // );
            await login(app, { email, password });
            await testSensitivityHigherThan(
              app,
              sensitivityToTest,
              property,
              role,
              readFunction
            );
            await login(app, { email, password });
          }
        );

        // it(' reading records', async () => {
        //   await login(app, { email: email, password: password });
        //   const proj = await createProject(app, { type: projectType });
        //   const budget = await createBudget(app, { projectId: proj.id });
        //   const org = await createOrganization(app);
        //   const partner = await createPartner(app, {
        //     organizationId: org.id,
        //   });
        //   await createPartnership(app, {
        //     partnerId: partner.id,
        //     projectId: proj.id,
        //     types: [PartnerType.Funding, PartnerType.Managing],
        //     financialReportingType: undefined,
        //     mouStartOverride: CalendarDate.fromISO('2000-01-01'),
        //     mouEndOverride: CalendarDate.fromISO('2004-01-01'),
        //   });
        //   await addLocationToOrganization(app, org.id);
        //   await expectSensitiveRelationList({
        //     app,
        //     role,
        //     sensitivityRestriction: sensitivityToTest,
        //     projectId: proj.id,
        //     projectType: projectType,
        //     propertyToCheck: 'records',
        //     readFunction: readOneBudgetRecord,
        //     resourceId: budget.id,
        //     perms: await getPermissions({
        //       resource: Budget,
        //       userRole: `global:${role as Role}` as ScopedRole,
        //     }),
        //   });
        // });
      }
    );
  });
});
async function testSensitivityHigherThan<TResource extends ResourceShape<any>>(
  app: TestApp,
  sensitivity: Sensitivity,
  property: keyof SecuredProps<TResource>,
  role: Role,
  readFunction: ReadOneFunction<TResource['prototype']>
) {
  const medSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Medium,
  });
  const highSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.High,
  });

  await registerUserWithPower(app, [], { roles: [role] });
  const medRead = await readFunction(app, medSenslanguage.id);
  const highRead = await readFunction(app, highSenslanguage.id);
  switch (sensitivity) {
    case Sensitivity.Low: {
      expect(medRead[property].canRead).toBeFalsy();
      expect(medRead[property].canEdit).toBeFalsy();
      expect(highRead[property].canRead).toBeFalsy();
      expect(highRead[property].canEdit).toBeFalsy();
      break;
    }
    case Sensitivity.Medium: {
      expect(highRead[property].canRead).toBeFalsy();
      expect(highRead[property].canEdit).toBeFalsy();
      break;
    }
    case Sensitivity.High: {
      // nothing higher than High, so just break.
      break;
    }
  }
}
async function testSensitivityLowerThanEqualTo<TResource extends ResourceShape<any>>(
  app: TestApp,
  sensitivity: Sensitivity,
  property: keyof SecuredProps<TResource>,
  perms: PermissionsOf<SecuredResource<TResource>>,
  readFunction: ReadOneFunction<TResource['prototype']>
) {
  //test languages with sensitivity lower than/equal to what we're testing.
  const highSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.High,
  });
  const medSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Medium,
  });
  const lowSenslanguage = await createLanguage(app, {
    sensitivity: Sensitivity.Low,
  });
  const readHigh = await readFunction(app, highSenslanguage.id);
  const readMed = await readFunction(app, medSenslanguage.id);
  const readLow = await readFunction(app, lowSenslanguage.id);
  switch (sensitivity) {
    case Sensitivity.High: {
      expect(readHigh[property].canRead).toEqual(
        perms[property].canRead
      );
      expect(highSenslanguage[property].canEdit).toEqual(
        perms[property].canEdit
      );
    }
    // disabling fallthrough because I for realz want to do it. I want to create High, Med, and Low for the high sensitivity case
    //    keeps me from having to repeat code
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Medium: {
      expect(medSenslanguage[property].canRead).toEqual(
        perms[property].canRead
      );
      expect(medSenslanguage[property].canEdit).toEqual(
        perms[property].canEdit
      );
    }
    // I for realz want to fallthrough, because I want to create medium and low for medium sensitivity
    // eslint-disable-next-line no-fallthrough
    case Sensitivity.Low: {
      expect(lowSenslanguage[property].canRead).toEqual(
        perms[property].canRead
      );
      expect(lowSenslanguage[property].canEdit).toEqual(
        perms[property].canEdit
      );
    }
  }
}
