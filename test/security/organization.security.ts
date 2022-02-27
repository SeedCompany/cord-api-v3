import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers, Role, ScopedRole } from '../../src/components/authorization';
import { Organization } from '../../src/components/organization';
import { PartnerType } from '../../src/components/partner';
import { FinancialReportingType } from '../../src/components/partnership';
import { ProjectType } from '../../src/components/project';
import {
  addLocationToOrganization,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  readOneOrganization,
  readOneOrgLocations,
  registerUserWithPower,
  TestApp,
} from '../utility';
import {
  expectSensitiveProperty,
  expectSensitiveRelationList,
} from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Organization Security e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
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
  });

  afterAll(async () => {
    await app.close();
  });

  // describe('Restricted by role', () => {
  //   describe.each`
  //     role                                      | locationsCanCreate
  //     ${Role.Administrator}                     | ${true}
  //     ${Role.Consultant}                        | ${false}
  //     ${Role.ConsultantManager}                 | ${false}
  //     ${Role.Controller}                        | ${true}
  //     ${Role.FieldOperationsDirector}           | ${false}
  //     ${Role.FinancialAnalyst}                  | ${false}
  //     ${Role.Fundraising}                       | ${false}
  //     ${Role.Intern}                            | ${false}
  //     ${Role.LeadFinancialAnalyst}              | ${true}
  //     ${Role.Leadership}                        | ${false}
  //     ${Role.Liaison}                           | ${false}
  //     ${Role.Marketing}                         | ${false}
  //     ${Role.Mentor}                            | ${false}
  //     ${Role.ProjectManager}                    | ${false}
  //     ${Role.RegionalCommunicationsCoordinator} | ${false}
  //   `('Global $role', ({ role, locationsCanCreate }) => {
  //     test.each`
  //       property       | readFunction           | staticResource  | skipEditCheck
  //       ${'name'}      | ${readOneOrganization} | ${Organization} | ${false}
  //       ${'address'}   | ${readOneOrganization} | ${Organization} | ${false}
  //       ${'locations'} | ${readOneOrganization} | ${Organization} | ${true}
  //     `(
  //       ' reading $staticResource.name $property',
  //       async ({ property, readFunction, staticResource, skipEditCheck }) => {
  //         await testRole({
  //           app: app,
  //           resource: testOrg,
  //           staticResource: staticResource,
  //           role: role,
  //           readOneFunction: readFunction,
  //           propToTest: property,
  //           skipEditCheck: skipEditCheck,
  //         });
  //       }
  //     );
  //     it(' reading Organization locations canEdit', async () => {
  //       const read = await runInIsolatedSession(app, async () => {
  //         await registerUser(app, { roles: [role] });
  //         return await readOneOrgLocations(app, testOrg.id);
  //       });
  //       expect(read.canCreate).toEqual(locationsCanCreate);
  //     });
  //   });
  // });

  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                     | sensitivityToTest
      ${Role.StaffMember}      | ${Sensitivity.Low}
      ${Role.Marketing}        | ${Sensitivity.Low}
      ${Role.Fundraising}      | ${Sensitivity.Medium}
      ${Role.FinancialAnalyst} | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property       | resource        | readFunction           | type
          ${'name'}      | ${Organization} | ${readOneOrganization} | ${ProjectType.Translation}
          ${'name'}      | ${Organization} | ${readOneOrganization} | ${ProjectType.Internship}
          ${'locations'} | ${Organization} | ${readOneOrganization} | ${ProjectType.Translation}
          ${'locations'} | ${Organization} | ${readOneOrganization} | ${ProjectType.Internship}
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
            await addLocationToOrganization({ app, orgId: o.id });
            await expectSensitiveProperty({
              app,
              role,
              propertyToCheck: property,
              projectId: proj.id,
              resourceId: o.id,
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
    describe.each`
      type
      ${ProjectType.Translation}
      ${ProjectType.Internship}
    `('', ({ type }) => {
      it(`Role: ConsultantManager - Sensitivity: Medium\n reading ${
        type as string
      } Organization locations`, async () => {
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
        await addLocationToOrganization({ app, orgId: o.id });
        await expectSensitiveRelationList({
          app,
          role: Role.ConsultantManager,
          resource: Organization,
          propertyToCheck: 'locations',
          projectId: proj.id,
          resourceId: o.id,
          sensitivityRestriction: Sensitivity.Medium,
          projectType: type,
          perms: await getPermissions({
            resource: Organization,
            userRole: `global:${Role.ConsultantManager}`,
            sensitivity: Sensitivity.Medium,
          }),
          readFunction: readOneOrgLocations,
        });
      });
    });
  });
});
