import { Connection } from 'cypher-query-builder';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers, Role, ScopedRole } from '../../src/components/authorization';
import { Budget } from '../../src/components/budget';
import { PartnerType } from '../../src/components/partner';
import { Project, ProjectType } from '../../src/components/project';
import {
  addLocationToOrganization,
  createBudget,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  Raw,
  readBudgetRecords,
  readOneBudget,
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

describe('Budget Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let testProject: Raw<Project>;
  let testBudget: Budget;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateOrganization,
      Powers.CreateProject,
      Powers.CreatePartnership,
      Powers.CreateBudget,
    ]);
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
            skipEditCheck: false,
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
            permissions: await getPermissions({
              resource: Budget,
              userRole: `global:${role as Role}` as ScopedRole,
            }),
            readOneFunction: readOneBudget,
            projectType: projectType,
          });
        });

        it(' reading records', async () => {
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
            resource: Budget,
            propertyToCheck: 'records',
            readFunction: readBudgetRecords,
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
