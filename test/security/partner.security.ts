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
        Powers.CreateLanguage,
        Powers.CreateLanguageEngagement,
        Powers.CreateEthnologueLanguage,
        Powers.CreateOrganization,
        Powers.CreatePartner,
        Powers.CreatePartnership,
      ],
      { email: email, password: password }
    );
    testProject = await createProject(app);
    const org = await createOrganization(app);
    const partnerWithProject = await createPartner(app, {
      organizationId: org.id,
    });
    await createPartnership(app, {
      partnerId: partnerWithProject.id,
      projectId: testProject.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      financialReportingType: undefined,
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
});
