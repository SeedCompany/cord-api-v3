import { Role } from '../../src/components/authorization';
import { Project } from '../../src/components/project';
import { User } from '../../src/components/user';
import {
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  listUsers,
  Raw,
  readOneUser,
  registerUser,
  runInIsolatedSession,
  TestApp,
  TestUser,
} from '../utility';
import { testRole } from '../utility/roles';

describe('Project Security e2e', () => {
  let app: TestApp;
  let testUser: TestUser;
  let testProject: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    testUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    testProject = await createProject(app);
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
        property              | readFunction   | staticResource | isSecureList
        ${'about'}            | ${readOneUser} | ${User}        | ${false}
        ${'displayFirstName'} | ${readOneUser} | ${User}        | ${false}
        ${'displayLastName'}  | ${readOneUser} | ${User}        | ${false}
        ${'email'}            | ${readOneUser} | ${User}        | ${false}
        ${'phone'}            | ${readOneUser} | ${User}        | ${false}
        ${'realFirstName'}    | ${readOneUser} | ${User}        | ${false}
        ${'realLastName'}     | ${readOneUser} | ${User}        | ${false}
        ${'roles'}            | ${readOneUser} | ${User}        | ${false}
        ${'status'}           | ${readOneUser} | ${User}        | ${false}
        ${'timezone'}         | ${readOneUser} | ${User}        | ${false}
        ${'title'}            | ${readOneUser} | ${User}        | ${false}
        ${'education'}        | ${readOneUser} | ${User}        | ${true}
        ${'organization'}     | ${readOneUser} | ${User}        | ${true}
        ${'partner'}          | ${readOneUser} | ${User}        | ${true}
        ${'unavailability'}   | ${readOneUser} | ${User}        | ${true}
        ${'locations'}        | ${readOneUser} | ${User}        | ${true}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource, isSecureList }) => {
          await testRole({
            app: app,
            resource: testUser,
            staticResource: staticResource,
            role: role,
            readOneFunction: readFunction,
            propToTest: property,
            isSecureList: isSecureList,
          });
        }
      );
    });
  });

  describe('Listing (other users than own) is secure', () => {
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
      ${Role.Liaison}                           | ${false}      | ${false}
      ${Role.Marketing}                         | ${true}       | ${true}
      ${Role.Mentor}                            | ${true}       | ${true}
      ${Role.ProjectManager}                    | ${true}       | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${false}      | ${false}
      ${Role.RegionalDirector}                  | ${true}       | ${true}
      ${Role.StaffMember}                       | ${true}       | ${true}
      ${Role.Translator}                        | ${false}      | ${false}
    `('$role', ({ role, globalCanList, projectCanList }) => {
      it('Global canList', async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listUsers(app);
        });
        if (!globalCanList) {
          expect(read).toHaveLength(1); // 1 because we always return the user's own info regardless of role
          expect(read).not.toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(1);
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
          return listUsers(app);
        });
        if (!projectCanList) {
          expect(read).toHaveLength(1);
          expect(read).not.toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(1);
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
