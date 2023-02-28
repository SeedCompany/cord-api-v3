import { Role } from '../../src/components/authorization';
import { InternshipEngagement } from '../../src/components/engagement';
import { Project, ProjectType } from '../../src/components/project';
import {
  createInternshipEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listInternshipEngagements,
  Raw,
  readOneInternshipEngagement,
  registerUser,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { RawInternshipEngagement } from '../utility/fragments';
import { testRole } from '../utility/roles';

describe('Internship Engagment Security e2e', () => {
  let app: TestApp;
  let testProject: Raw<Project>;
  let testInternshipEngagement: RawInternshipEngagement;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    testProject = await createProject(app, { type: ProjectType.Internship });
    const intern = await runInIsolatedSession(app, async () => {
      return await registerUser(app, {
        roles: [],
      });
    });
    testInternshipEngagement = await createInternshipEngagement(app, {
      projectId: testProject.id,
      internId: intern.id,
    });
  });

  afterAll(async () => {
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
        property                      | readFunction                   | staticResource
        ${'ceremony'}                 | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'completeDate'}             | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'countryOfOrigin'}          | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'disbursementCompleteDate'} | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'endDate'}                  | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'endDateOverride'}          | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'growthPlan'}               | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'initialEndDate'}           | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'intern'}                   | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'lastReactivatedAt'}        | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'lastSuspendedAt'}          | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'mentor'}                   | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'methodologies'}            | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'position'}                 | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'startDate'}                | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'startDateOverride'}        | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'statusModifiedAt'}         | ${readOneInternshipEngagement} | ${InternshipEngagement}
        ${'status'}                   | ${readOneInternshipEngagement} | ${InternshipEngagement}
      `(
        ' reading $staticResource.name $property',

        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testInternshipEngagement,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            skipEditCheck: false,
          });
        },
      );
    });
  });
  describe('Listing restricted by role', () => {
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
          return await listInternshipEngagements(app);
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
          return listInternshipEngagements(app);
        });
        if (!projectCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
