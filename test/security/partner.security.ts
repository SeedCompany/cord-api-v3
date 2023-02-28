import { CalendarDate, Sensitivity } from '../../src/common';
import { Role, ScopedRole } from '../../src/components/authorization';
import { Partner, PartnerType } from '../../src/components/partner';
import { FinancialReportingType } from '../../src/components/partnership';
import { Project, ProjectType } from '../../src/components/project';
import {
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listPartners,
  Raw,
  readOnePartner,
  registerUser,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';
import { expectSensitiveProperty } from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Partner Security e2e', () => {
  let app: TestApp;
  let testProject: Raw<Project>;
  let testPartner: Partner;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
    testProject = await createProject(app);
    const org = await createOrganization(app);
    testPartner = await createPartner(app, {
      organizationId: org.id,
    });
    await createPartnership(app, {
      partnerId: testPartner.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: undefined,
      mouStartOverride: CalendarDate.fromISO('2000-01-01'),
      mouEndOverride: CalendarDate.fromISO('2004-01-01'),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Restricted by role', () => {
    describe.each`
      role                                      | globalCanList | projectCanList
      ${Role.Administrator}                     | ${true}       | ${true}
      ${Role.Consultant}                        | ${false}      | ${true}
      ${Role.ConsultantManager}                 | ${true}       | ${true}
      ${Role.Controller}                        | ${true}       | ${true}
      ${Role.FieldOperationsDirector}           | ${true}       | ${true}
      ${Role.FinancialAnalyst}                  | ${true}       | ${true}
      ${Role.Fundraising}                       | ${false}      | ${false}
      ${Role.Intern}                            | ${true}       | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}       | ${true}
      ${Role.Leadership}                        | ${true}       | ${true}
      ${Role.Liaison}                           | ${false}      | ${false}
      ${Role.Marketing}                         | ${true}       | ${true}
      ${Role.Mentor}                            | ${true}       | ${true}
      ${Role.ProjectManager}                    | ${true}       | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${false}      | ${false}
      ${Role.RegionalDirector}                  | ${true}       | ${true}
      ${Role.StaffMember}                       | ${false}      | ${false}
      ${Role.Translator}                        | ${false}      | ${false}
    `('$role', ({ role, globalCanList, projectCanList }) => {
      it('Global canList', async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listPartners(app);
        });
        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });

      it('Project canList', async () => {
        const user = await runInIsolatedSession(app, async () => {
          return await registerUser(app, {
            roles: [role],
          });
        });
        const org1 = await createOrganization(app);
        await createPartner(app, {
          organizationId: org1.id,
        });
        const org2 = await createOrganization(app);
        await createPartner(app, {
          organizationId: org2.id,
        });
        await createProjectMember(app, {
          projectId: testProject.id,
          roles: role,
          userId: user.id,
        });
        const read = await user.runAs(() => {
          return listPartners(app);
        });
        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });

      test.each`
        property
        ${'organization'}
        ${'pointOfContact'}
        ${'types'}
        ${'financialReportingTypes'}
        ${'pmcEntityCode'}
        ${'globalInnovationsClient'}
        ${'active'}
        ${'address'}
      `(' reading Partner $property', async ({ property }) => {
        await testRole({
          app: app,
          resource: testPartner,
          staticResource: Partner,
          role: role,
          readOneFunction: readOnePartner,
          propToTest: property,
          skipEditCheck: false,
        });
      });
    });
  });

  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                | sensitivityToTest
      ${Role.StaffMember} | ${Sensitivity.Low}
      ${Role.Marketing}   | ${Sensitivity.Low}
      ${Role.Fundraising} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property                     | resource   | readFunction      | type
          ${'organization'}            | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'organization'}            | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'types'}                   | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'types'}                   | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'financialReportingTypes'} | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'financialReportingTypes'} | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'pmcEntityCode'}           | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'pmcEntityCode'}           | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'globalInnovationsClient'} | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'globalInnovationsClient'} | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'active'}                  | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'active'}                  | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
          ${'address'}                 | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'address'}                 | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
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
            await createPartnership(app, {
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
              resourceId: partner.id,
              resource: resource,
              sensitivityRestriction: sensitivityToTest,
              projectType: type,
              permissions: await getPermissions({
                app,
                resource: resource,
                userRole: `global:${role as Role}` as ScopedRole,
                sensitivity: sensitivityToTest,
              }),
              readOneFunction: readFunction,
            });
          },
        );
      },
    );
    describe.each`
      role                     | sensitivityToTest
      ${Role.FinancialAnalyst} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property            | resource   | readFunction      | type
          ${'pointOfContact'} | ${Partner} | ${readOnePartner} | ${ProjectType.Translation}
          ${'pointOfContact'} | ${Partner} | ${readOnePartner} | ${ProjectType.Internship}
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
            await createPartnership(app, {
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
              resourceId: partner.id,
              resource: resource,
              sensitivityRestriction: sensitivityToTest,
              projectType: type,
              permissions: await getPermissions({
                app,
                resource: resource,
                userRole: `global:${role as Role}` as ScopedRole,
                sensitivity: sensitivityToTest,
              }),
              readOneFunction: readFunction,
            });
          },
        );
      },
    );
  });
});
