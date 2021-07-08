import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../../src/common';
import { Powers } from '../../src/components/authorization/dto/powers';
import { Location } from '../../src/components/location';
import { PartnerType } from '../../src/components/partner';
import {
  IProject,
  Project,
  ProjectType,
  Role,
  ScopedRole,
} from '../../src/components/project';
import {
  createBudget,
  createLocation,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  login,
  Raw,
  readOneProject,
  readOneProjectBudget,
  readOneProjectOtherLocations,
  readOneProjectOtherLocationsItems,
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

describe('Project Security e2e', () => {
  let app: TestApp;
  let db: Connection;
  let email: string;
  let password: string;
  let testProject: Raw<Project>;
  let testLocation: Location;
  let primaryLocation: Location;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    email = faker.internet.email();
    password = faker.internet.password();
    await createSession(app);
    await registerUserWithPower(
      app,
      [
        Powers.CreateProject,
        Powers.CreateLocation,
        Powers.CreateLanguage,
        Powers.CreateLanguageEngagement,
        Powers.CreateEthnologueLanguage,
        Powers.CreateBudget,
        Powers.CreateOrganization,
        Powers.CreatePartner,
        Powers.CreatePartnership,
      ],
      { email: email, password: password }
    );
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
        property                       | readFunction      | staticResource
        ${'estimatedSubmission'}       | ${readOneProject} | ${IProject}
        ${'step'}                      | ${readOneProject} | ${IProject}
        ${'name'}                      | ${readOneProject} | ${IProject}
        ${'mouStart'}                  | ${readOneProject} | ${IProject}
        ${'mouEnd'}                    | ${readOneProject} | ${IProject}
        ${'initialMouEnd'}             | ${readOneProject} | ${IProject}
        ${'stepChangedAt'}             | ${readOneProject} | ${IProject}
        ${'tags'}                      | ${readOneProject} | ${IProject}
        ${'financialReportReceivedAt'} | ${readOneProject} | ${IProject}
        ${'primaryLocation'}           | ${readOneProject} | ${IProject}
        ${'budget'}                    | ${readOneProject} | ${IProject}
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
        await login(app, { email, password });
        await registerUserWithPower(app, [], { roles: role });
        const perms = await getPermissions({
          resource: IProject,
          userRole: `global:${role as Role}` as ScopedRole,
          sensitivity: testProject.sensitivity,
        });

        const read = await readOneProjectOtherLocations(app, testProject.id);

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
            await login(app, { email: email, password: password });
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
            await login(app, { email, password });
          }
        );
      }
    );
    it('reading currentBudget', async () => {
      await login(app, { email, password });
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
      await registerUserWithPower(app, [], { roles: [Role.ConsultantManager] });
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
      await login(app, { email, password });
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
          await login(app, { email, password });
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
          await login(app, { email, password });
        });
        it('reading otherLocations Translation project', async () => {
          await login(app, { email, password });
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
          await login(app, { email, password });
        });
      }
    );
  });
});
