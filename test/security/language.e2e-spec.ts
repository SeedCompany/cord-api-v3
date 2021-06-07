import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
import { Budget } from '../../src/components/budget';
import { Language } from '../../src/components/language/dto';
import { Location } from '../../src/components/location';
import { PartnerType } from '../../src/components/partner';
import {
  Project,
  ProjectType,
  Role,
  ScopedRole,
} from '../../src/components/project';
import {
  addLocationToLanguage,
  addLocationToOrganization,
  createBudget,
  createLanguage,
  createLocation,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  login,
  Raw,
  readOneBudget,
  readOneBudgetRecord,
  readOneLanguage,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
import {
  expectSensitiveProperty,
  expectSensitiveRelationList,
} from '../utility/sensitivity';
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
      'Role: $role - Sensitivity: $sensitivityToTest on $projectType Project',
      ({ role, sensitivityToTest, projectType }) => {
        test.each`
        property
        registryOfDialectsCode
        signLanguageCode
        `(' reading $property', async ({property}) => {
          await login(app, { email: email, password: password });
          const budget = await createBudget(app, { projectId: proj.id });
          await expectSensitiveProperty({
            app,
            role: role,
            propertyToCheck: 'universalTemplateFile',
            projectId: proj.id,
            resourceId: budget.id,
            resource: Budget,
            sensitivityRestriction: sensitivityToTest,
            permissions: await getPermissions({
              resource: Budget,
              userRole: `global:${role as Role}` as ScopedRole,
            }),
            readOneFunction: readOneBudget,
            projectType: projectType,
          });

        });

        it(' reading records', async () => {
          await login(app, { email: email, password: password });
          const proj = await createProject(app, { type: projectType });
          const budget = await createBudget(app, { projectId: proj.id });
          const org = await createOrganization(app);
          const partner = await createPartner(app, {
            organizationId: org.id,
          });
          await createPartnership(app, {
            partnerId: partner.id,
            projectId: proj.id,
            types: [PartnerType.Funding, PartnerType.Managing],
            financialReportingType: undefined,
            mouStartOverride: CalendarDate.fromISO('2000-01-01'),
            mouEndOverride: CalendarDate.fromISO('2004-01-01'),
          });
          await addLocationToOrganization(app, org.id);
          await expectSensitiveRelationList({
            app,
            role,
            sensitivityRestriction: sensitivityToTest,
            projectId: proj.id,
            projectType: projectType,
            propertyToCheck: 'records',
            readFunction: readOneBudgetRecord,
            resourceId: budget.id,
            perms: await getPermissions({
              resource: Budget,
              userRole: `global:${role as Role}` as ScopedRole,
            }),
          });
        });
      }
    );
  });
});