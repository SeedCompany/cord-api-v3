import { Powers, Role } from '../../src/components/authorization';
import { Project, ProjectMember } from '../../src/components/project';
import { User } from '../../src/components/user/dto';
import {
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listProjectMembers,
  Raw,
  readOneProjectMember,
  registerUser,
  registerUserWithPower,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';

describe('Project Member Security e2e', () => {
  let app: TestApp;
  let testProject: Raw<Project>;
  let testProjectMember: Raw<ProjectMember>;
  let testUser: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateProject,
      Powers.CreateProjectMember,
    ]);
    testUser = await runInIsolatedSession(
      app,
      async () => await registerUser(app, { roles: [Role.Consultant] })
    );
    testProject = await createProject(app);
    testProjectMember = await createProjectMember(app, {
      projectId: testProject.id,
      userId: testUser.id,
      roles: [Role.Consultant],
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
        property   | readFunction            | staticResource
        ${'roles'} | ${readOneProjectMember} | ${ProjectMember}
        ${'user'}  | ${readOneProjectMember} | ${ProjectMember}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testProjectMember,
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
          return await listProjectMembers(app);
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
          return listProjectMembers(app);
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
