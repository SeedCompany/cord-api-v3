import { Connection } from 'cypher-query-builder';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers, Role, ScopedRole } from '../../src/components/authorization';
import { Partner, PartnerType } from '../../src/components/partner';
import {
  FinancialReportingType,
  Partnership,
} from '../../src/components/partnership';
import { Project, ProjectType } from '../../src/components/project';
import {
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  Raw,
  readOnePartnership,
  registerUserWithPower,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
import { expectSensitiveProperty } from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Project Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let testProject: Raw<Project>;
  let testPartner: Partner;
  let testPartnership: Partnership;
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateProject,
      Powers.CreateLocation,
      Powers.CreateLanguage,
      Powers.CreateLanguageEngagement,
      Powers.CreateEthnologueLanguage,
      Powers.CreateBudget,
      Powers.CreateOrganization,
      Powers.CreatePartner,
      Powers.CreatePartnership,
    ]);
    testProject = await createProject(app);
    const org = await createOrganization(app);
    testPartner = await createPartner(app, {
      organizationId: org.id,
    });
    testPartnership = await createPartnership(app, {
      partnerId: testPartner.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: FinancialReportingType.Funded,
      mouStartOverride: CalendarDate.fromISO('2000-01-01'),
      mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    });
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
        property              | readFunction          | staticResource | skipEditCheck
        ${'agreementStatus'}  | ${readOnePartnership} | ${Partnership} | ${false}
        ${'mouStart'}         | ${readOnePartnership} | ${Partnership} | ${true}
        ${'mouEnd'}           | ${readOnePartnership} | ${Partnership} | ${true}
        ${'mouStartOverride'} | ${readOnePartnership} | ${Partnership} | ${false}
        ${'mouEndOverride'}   | ${readOnePartnership} | ${Partnership} | ${false}
        ${'types'}            | ${readOnePartnership} | ${Partnership} | ${false}
        ${'partner'}          | ${readOnePartnership} | ${Partnership} | ${false}
        ${'primary'}          | ${readOnePartnership} | ${Partnership} | ${false}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource, skipEditCheck }) => {
          await testRole({
            app: app,
            resource: testPartnership,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            skipEditCheck: skipEditCheck,
          });
        }
      );
      it('should not be able to edit mouStart and mouEnd', async () => {
        // still logged in under role, testRole doesn't reset the login
        const p = await readOnePartnership(app, testPartnership.id);
        expect(p.mouStart.canEdit).toBe(false);
        expect(p.mouEnd.canEdit).toBe(false);
      });
    });
  });
  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest
      ${Role.StaffMember}       | ${Sensitivity.Low}
      ${Role.Marketing}         | ${Sensitivity.Low}
      ${Role.Fundraising}       | ${Sensitivity.Medium}
      ${Role.ConsultantManager} | ${Sensitivity.Low}
      ${Role.FinancialAnalyst}  | ${Sensitivity.Medium}
      ${Role.ProjectManager}    | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property     | resource       | readFunction          | type
          ${'partner'} | ${Partnership} | ${readOnePartnership} | ${ProjectType.Translation}
          ${'partner'} | ${Partnership} | ${readOnePartnership} | ${ProjectType.Internship}
        `(
          ' reading $type $resource.name $property',
          async ({ property, resource, readFunction, type }) => {
            const proj = await createProject(app, {
              type,
            });
            const o = await createOrganization(app);
            const partner = await createPartner(app, {
              organizationId: o.id,
            });
            const partship = await createPartnership(app, {
              partnerId: partner.id,
              projectId: proj.id,
              types: [PartnerType.Funding, PartnerType.Managing],
              financialReportingType: FinancialReportingType.Funded,
              mouStartOverride: CalendarDate.fromISO('2000-01-01'),
              mouEndOverride: CalendarDate.fromISO('2004-01-01'),
            });
            await expectSensitiveProperty({
              app,
              role,
              propertyToCheck: property,
              projectId: proj.id,
              resourceId: partship.id,
              resource: resource,
              sensitivityRestriction: sensitivityToTest,
              projectType: type,
              permissions: await getPermissions({
                resource: resource,
                userRole: `global:${role as Role}` as ScopedRole,
                sensitivity: sensitivityToTest,
              }),
              readOneFunction: readFunction,
            });
          }
        );
      }
    );
  });
});
