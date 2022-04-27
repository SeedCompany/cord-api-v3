import { Role } from '../../src/components/authorization';
import { FieldZone } from '../../src/components/field-zone';
import {
  createSession,
  createTestApp,
  createZone,
  listFieldZones,
  readOneZone,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';

describe('Partnership Security e2e', () => {
  let app: TestApp;
  let testFieldZone: FieldZone;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    testFieldZone = await runAsAdmin(app, async () => await createZone(app));
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
        property      | readFunction   | staticResource
        ${'director'} | ${readOneZone} | ${FieldZone}
        ${'name'}     | ${readOneZone} | ${FieldZone}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testFieldZone,
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
      role                                      | globalCanList
      ${Role.Administrator}                     | ${true}
      ${Role.Consultant}                        | ${true}
      ${Role.ConsultantManager}                 | ${true}
      ${Role.Controller}                        | ${true}
      ${Role.FieldOperationsDirector}           | ${true}
      ${Role.FinancialAnalyst}                  | ${true}
      ${Role.Fundraising}                       | ${true}
      ${Role.Intern}                            | ${true}
      ${Role.LeadFinancialAnalyst}              | ${true}
      ${Role.Leadership}                        | ${true}
      ${Role.Liaison}                           | ${false}
      ${Role.Marketing}                         | ${true}
      ${Role.Mentor}                            | ${false}
      ${Role.ProjectManager}                    | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${false}
      ${Role.RegionalDirector}                  | ${true}
      ${Role.StaffMember}                       | ${true}
      ${Role.Translator}                        | ${false}
    `('$role', ({ role, globalCanList }) => {
      it(`Global canList: ${globalCanList as string}`, async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listFieldZones(app);
        });
        if (!globalCanList) {
          expect(read).toHaveLength(0);
        } else {
          expect(read).not.toHaveLength(0);
        }
      });
    });
  });
});
