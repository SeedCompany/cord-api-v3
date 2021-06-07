import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { SecuredProps, SecuredResource, Sensitivity } from '../../src/common';
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
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
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
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property                    | resource
          ${'registryOfDialectsCode'} | ${Language}
          ${'signLanguageCode'}       | ${Language}
          ${'code'}                   | ${EthnologueLanguage}
          ${'name'}                   | ${EthnologueLanguage}
          ${'population'}             | ${EthnologueLanguage}
          ${'provisionalCode'}        | ${EthnologueLanguage}
        `(' reading $property', async (property) => {
          await login(app, { email: email, password: password });
          const perms = await getPermissions({
            resource: Language,
            userRole: role,
          });
          await testSensitivityLowerThanEqualTo(
            app,
            sensitivityToTest,
            property as keyof SecuredProps<Language>,
            perms
          );
          await login(app, { email, password });
          await testSensitivityHigherThan(
            app,
            sensitivityToTest,
            property as keyof SecuredProps<Language>,
            role
          );
          await login(app, { email, password });
        });

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
async function testSensitivityHigherThan(
  app: TestApp,
  sensitivity: Sensitivity,
  property: keyof SecuredProps<Language>,
  role: Role
) {
  switch (sensitivity) {
    case Sensitivity.Low: {
      const medSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.Medium,
      });
      const highSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.High,
      });
      await registerUserWithPower(app, [], { roles: [role] });
      expect(medSenslanguage[property].canRead).toBeFalsy();
      expect(medSenslanguage[property].canEdit).toBeFalsy();
      expect(highSenslanguage[property].canRead).toBeFalsy();
      expect(highSenslanguage[property].canEdit).toBeFalsy();
      break;
    }
    case Sensitivity.Medium: {
      const highSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.High,
      });
      expect(highSenslanguage[property].canRead).toBeFalsy();
      expect(highSenslanguage[property].canEdit).toBeFalsy();
      break;
    }
    case Sensitivity.High: {
      // nothing higher than High, so just break.
      break;
    }
  }
}
async function testSensitivityLowerThanEqualTo(
  app: TestApp,
  sensitivity: Sensitivity,
  property: keyof SecuredProps<Language>,
  perms: PermissionsOf<SecuredResource<typeof Language>>
) {
  //test languages with sensitivity lower than/equal to what we're testing.
  switch (sensitivity) {
    case Sensitivity.High: {
      const highSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.High,
      });
      expect(highSenslanguage[property].canRead).toEqual(
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
      const medSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.Medium,
      });
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
      const lowSenslanguage = await createLanguage(app, {
        sensitivity: Sensitivity.Low,
      });
      expect(lowSenslanguage[property].canRead).toEqual(
        perms[property].canRead
      );
      expect(lowSenslanguage[property].canEdit).toEqual(
        perms[property].canEdit
      );
    }
  }
}
