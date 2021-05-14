import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
import { Budget, BudgetRecord } from '../../src/components/budget';
import { Organization } from '../../src/components/organization';
import { PartnerType } from '../../src/components/partner';
import {
  Project,
  ProjectType,
  Role,
  ScopedRole,
} from '../../src/components/project';
import {
  addLocationToOrganization,
  createBudget,
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
  readOneBudgetRecordOrganization,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole, testRoleOnRelationArrayProp } from '../utility/roles';
import { expectSensitiveProperty } from '../utility/sensitivity';
import { getPermissions, getPermissionsByProp } from './permissions';

describe('Budget Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;
  let testProject: Raw<Project>;
  let testBudget: Budget;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateOrganization,
        Powers.CreateProject,
        Powers.CreatePartnership,
        Powers.CreateBudget,
      ],
      { email: email, password: password }
    );
    testProject = await createProject(app);
    testBudget = await createBudget(app, { projectId: testProject.id });
    const org = await createOrganization(app);
    const partner = await createPartner(app, {
      organizationId: org.id,
    });
    await createPartnership(app, {
      partnerId: partner.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: undefined,
      mouStartOverride: CalendarDate.fromISO('2000-01-01'),
      mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    });
    await addLocationToOrganization(app, org.id);
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
        property                   | readFunction     | staticResource
        ${'universalTemplateFile'} | ${readOneBudget} | ${Budget}
      `(
        ' reading $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: { ...testBudget, sensitivity: testProject.sensitivity },
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
          });
        }
      );
      test.each`
        property        | readFunction           | staticResource  | parentResource | parentProp
        ${'amount'}     | ${readOneBudgetRecord} | ${BudgetRecord} | ${Budget}      | ${'records'}
        ${'fiscalYear'} | ${readOneBudgetRecord} | ${BudgetRecord} | ${Budget}      | ${'records'}
      `(
        ' reading budget $parentProp -> $property',
        async ({
          property,
          readFunction,
          staticResource,
          parentResource,
          parentProp,
        }) => {
          await testRoleOnRelationArrayProp({
            app: app,
            resource: { ...testBudget, sensitivity: testProject.sensitivity },
            staticResource: staticResource,
            parentResource: parentResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            parentProp: parentProp,
          });
        }
      );
    });
  });
  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest     | projectType
      ${Role.ConsultantManager} | ${Sensitivity.Medium} | ${ProjectType.Translation}
      ${Role.ConsultantManager} | ${Sensitivity.Medium} | ${ProjectType.Internship}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest on $projectType Project',
      ({ role, sensitivityToTest, projectType }) => {
        it(' reading universalTemplateFile', async () => {
          await login(app, { email: email, password: password });
          const proj = await createProject(app, { type: projectType });
          const budget = await createBudget(app, { projectId: proj.id });
          await expectSensitiveProperty({
            app,
            role: role,
            propertyToCheck: 'universalTemplateFile',
            projectId: proj.id,
            resourceId: budget.id,
            resource: Budget,
            sensitivityRestriction: sensitivityToTest,
            permissions: (await getPermissions({
              resource: Budget,
              userRole: `global:${role as Role}` as ScopedRole,
            })) as Partial<Budget>,
            readOneFunction: readOneBudget,
            projectType: projectType,
          });
        });

        test.each`
          property
          ${'amount'}
          ${'fiscalYear'}
          ${'organization'}
        `(' reading records: $property', async ({ property }) => {
          await login(app, { email: email, password: password });
          const proj = await createProject(app, { type: projectType });
          const budget = await createBudget(app, { projectId: proj.id });
          await createPartnership(app, {
            projectId: proj.id,
            types: [PartnerType.Funding, PartnerType.Managing],
            financialReportingType: undefined,
            mouStartOverride: CalendarDate.fromISO('2000-01-01'),
            mouEndOverride: CalendarDate.fromISO('2004-01-01'),
          });

          await expectSensitiveProperty({
            app: app,
            role: role,
            propertyToCheck: property,
            projectId: proj.id,
            resourceId: budget.id,
            resource: BudgetRecord,
            sensitivityRestriction: sensitivityToTest,
            permissions: (await getPermissionsByProp({
              resource: BudgetRecord,
              parentResource: Budget,
              parentProp: 'records',
              userRole: `global:${role as Role}` as ScopedRole,
            })) as Partial<BudgetRecord>,
            readOneFunction: readOneBudgetRecord,
            projectType: projectType,
          });
          await login(app, { email: email, password: password });
        });

        test.each`
          property
          ${'name'}
          ${'address'}
          ${'locations'}
        `(
          ' reading records -> organization: $property',
          async ({ property }) => {
            await login(app, { email: email, password: password });
            const proj = await createProject(app, { type: projectType });
            const budget = await createBudget(app, { projectId: proj.id });
            const org = await createOrganization(app);
            const partner = await createPartner(app, {
              organizationId: org.id,
            });
            await createPartnership(app, {
              projectId: proj.id,
              types: [PartnerType.Funding, PartnerType.Managing],
              financialReportingType: undefined,
              mouStartOverride: CalendarDate.fromISO('2000-01-01'),
              mouEndOverride: CalendarDate.fromISO('2004-01-01'),
              partnerId: partner.id,
            });
            await addLocationToOrganization(app, org.id);
            await expectSensitiveProperty({
              app: app,
              role: role,
              propertyToCheck: property,
              projectId: proj.id,
              resourceId: budget.id,
              resource: Organization,
              sensitivityRestriction: sensitivityToTest,
              permissions: (await getPermissionsByProp({
                resource: Organization,
                parentResource: BudgetRecord,
                parentProp: 'organization',
                userRole: `global:${role as Role}` as ScopedRole,
              })) as Partial<BudgetRecord>,
              readOneFunction: readOneBudgetRecordOrganization,
              projectType: projectType,
            });
            await login(app, { email: email, password: password });
          }
        );
      }
    );
  });
});
