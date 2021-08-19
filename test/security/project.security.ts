import { Connection } from 'cypher-query-builder';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers, Role, ScopedRole } from '../../src/components/authorization';
import { Location } from '../../src/components/location';
import { PartnerType } from '../../src/components/partner';
import { IProject, Project, ProjectType } from '../../src/components/project';
import {
  createBudget,
  createLocation,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listProjects,
  Raw,
  readOneProject,
  readOneProjectBudget,
  readOneProjectOtherLocations,
  readOneProjectOtherLocationsItems,
  registerUser,
  registerUserWithPower,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { resetDatabase } from '../utility/reset-database';
import { testRole } from '../utility/roles';
import {
  expectSensitiveProperty,
  expectSensitiveRelationList,
} from '../utility/sensitivity';
import { getPermissions } from './permissions';

describe('Project Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let testProject: Raw<Project>;
  let testLocation: Location;
  let primaryLocation: Location;

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
    testLocation = await createLocation(app);
    primaryLocation = await createLocation(app);
    testProject = await createProject(app, {
      otherLocationIds: [testLocation.id],
      primaryLocationId: primaryLocation.id,
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
        property                       | readFunction            | staticResource
        ${'estimatedSubmission'}       | ${readOneProject}       | ${IProject}
        ${'step'}                      | ${readOneProject}       | ${IProject}
        ${'name'}                      | ${readOneProject}       | ${IProject}
        ${'mouStart'}                  | ${readOneProject}       | ${IProject}
        ${'mouEnd'}                    | ${readOneProject}       | ${IProject}
        ${'initialMouEnd'}             | ${readOneProject}       | ${IProject}
        ${'stepChangedAt'}             | ${readOneProject}       | ${IProject}
        ${'tags'}                      | ${readOneProject}       | ${IProject}
        ${'financialReportReceivedAt'} | ${readOneProject}       | ${IProject}
        ${'primaryLocation'}           | ${readOneProject}       | ${IProject}
        ${'budget'}                    | ${readOneProjectBudget} | ${IProject}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testProject,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            skipEditCheck: false,
          });
        }
      );

      it('reading otherLocations', async () => {
        const perms = await getPermissions({
          resource: IProject,
          userRole: `global:${role as Role}` as ScopedRole,
          sensitivity: testProject.sensitivity,
        });

        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await readOneProjectOtherLocations(app, testProject.id);
        });

        expect(read.canRead).toEqual(perms.otherLocations.canRead);
        expect(read.canCreate).toEqual(perms.otherLocations.canEdit);

        if (!perms.otherLocations.canRead) {
          expect(read.items).toHaveLength(0);
        } else {
          expect(read.items).not.toHaveLength(0);
        }
      });
    });
  });
  describe('Listing is secure', () => {
    describe.each`
      role                                      | globalCanList | projectCanList
      ${Role.Administrator}                     | ${true}       | ${true}
      ${Role.Consultant}                        | ${true}       | ${true}
      ${Role.ConsultantManager}                 | ${true}       | ${true}
      ${Role.Controller}                        | ${true}       | ${true}
      ${Role.FieldOperationsDirector}           | ${true}       | ${true}
      ${Role.FinancialAnalyst}                  | ${true}       | ${true}
      ${Role.Fundraising}                       | ${true}       | ${true}
      ${Role.Intern}                            | ${true}       | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}       | ${true}
      ${Role.Leadership}                        | ${true}       | ${true}
      ${Role.Liaison}                           | ${true}       | ${true}
      ${Role.Marketing}                         | ${true}       | ${true}
      ${Role.Mentor}                            | ${true}       | ${true}
      ${Role.ProjectManager}                    | ${true}       | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${true}       | ${true}
      ${Role.RegionalDirector}                  | ${true}       | ${true}
      ${Role.StaffMember}                       | ${true}       | ${true}
      ${Role.Translator}                        | ${true}       | ${true}
    `('$role', ({ role, globalCanList, projectCanList }) => {
      it('Global canList', async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listProjects(app);
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
        await createProjectMember(app, {
          projectId: testProject.id,
          roles: role,
          userId: user.id,
        });
        const read = await user.runAs(() => {
          return listProjects(app);
        });
        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
  describe('Restricted by Sensitivity', () => {
    describe.each`
      role                      | sensitivityToTest
      ${Role.StaffMember}       | ${Sensitivity.Low}
      ${Role.Marketing}         | ${Sensitivity.Low}
      ${Role.Fundraising}       | ${Sensitivity.Medium}
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
      ${Role.FinancialAnalyst}  | ${Sensitivity.Medium}
      ${Role.ProjectManager}    | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        test.each`
          property             | resource    | readFunction      | type
          ${'primaryLocation'} | ${IProject} | ${readOneProject} | ${ProjectType.Translation}
          ${'primaryLocation'} | ${IProject} | ${readOneProject} | ${ProjectType.Internship}
        `(
          ' reading $type $resource.name $property',
          async ({ property, resource, readFunction, type }) => {
            const proj = await createProject(app, {
              primaryLocationId: primaryLocation.id,
              type,
            });
            await expectSensitiveProperty({
              app,
              role,
              propertyToCheck: property,
              projectId: proj.id,
              resourceId: proj.id,
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
    it('reading currentBudget', async () => {
      const proj = await createProject(app);
      await createBudget(app, { projectId: proj.id });
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
      const perms = await getPermissions({
        resource: IProject,
        userRole: `global:${Role.ConsultantManager as Role}` as ScopedRole,
        sensitivity: Sensitivity.Medium,
      });

      await expectSensitiveProperty({
        app,
        role: Role.ConsultantManager,
        propertyToCheck: 'budget',
        projectId: proj.id,
        resourceId: proj.id,
        resource: IProject,
        sensitivityRestriction: Sensitivity.Medium,
        projectType: ProjectType.Translation,
        permissions: perms,
        readOneFunction: readOneProjectBudget,
      });
    });
    describe.each`
      role                      | sensitivityToTest
      ${Role.StaffMember}       | ${Sensitivity.Low}
      ${Role.Marketing}         | ${Sensitivity.Low}
      ${Role.Fundraising}       | ${Sensitivity.Medium}
      ${Role.ConsultantManager} | ${Sensitivity.Medium}
      ${Role.FinancialAnalyst}  | ${Sensitivity.Medium}
      ${Role.ProjectManager}    | ${Sensitivity.Medium}
    `(
      'Role: $role - Sensitivity: $sensitivityToTest',
      ({ role, sensitivityToTest }) => {
        it('reading otherLocations Internship project', async () => {
          const proj = await createProject(app, {
            otherLocationIds: [testLocation.id],
            type: ProjectType.Internship,
          });
          await expectSensitiveRelationList({
            app,
            role,
            sensitivityRestriction: sensitivityToTest,
            projectId: proj.id,
            projectType: proj.type,
            readFunction: readOneProjectOtherLocationsItems,
            resourceId: proj.id,
            resource: IProject,
            propertyToCheck: 'otherLocations',
            perms: await getPermissions({
              resource: IProject,
              userRole: `global:${role as Role}` as ScopedRole,
              sensitivity: sensitivityToTest,
            }),
          });
        });
        it('reading otherLocations Translation project', async () => {
          const proj = await createProject(app, {
            otherLocationIds: [testLocation.id],
            type: ProjectType.Translation,
          });
          await expectSensitiveRelationList({
            app,
            role,
            sensitivityRestriction: sensitivityToTest,
            projectId: proj.id,
            projectType: proj.type,
            readFunction: readOneProjectOtherLocationsItems,
            resourceId: proj.id,
            resource: IProject,
            propertyToCheck: 'otherLocations',
            perms: await getPermissions({
              resource: IProject,
              userRole: `global:${role as Role}` as ScopedRole,
              sensitivity: sensitivityToTest,
            }),
          });
        });
      }
    );
  });
});
