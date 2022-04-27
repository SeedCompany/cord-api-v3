import { Role } from '../../src/components/authorization';
import { FundingAccount } from '../../src/components/funding-account';
import {
  createFundingAccount,
  createSession,
  createTestApp,
  listFundingAccounts,
  readOneFundingAccount,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
} from '../utility';
import { testRole } from '../utility/roles';

describe('Funding Account Security e2e', () => {
  let app: TestApp;
  let testFundingAccount: FundingAccount;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
    testFundingAccount = await runAsAdmin(
      app,
      async () => await createFundingAccount(app)
    );
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
        property           | readFunction             | staticResource
        ${'accountNumber'} | ${readOneFundingAccount} | ${FundingAccount}
        ${'name'}          | ${readOneFundingAccount} | ${FundingAccount}
      `(
        ' reading $staticResource.name $property',
        async ({ property, readFunction, staticResource }) => {
          await testRole({
            app: app,
            resource: testFundingAccount,
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
      ${Role.Consultant}                        | ${false}
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
      ${Role.Mentor}                            | ${true}
      ${Role.ProjectManager}                    | ${true}
      ${Role.RegionalCommunicationsCoordinator} | ${false}
      ${Role.RegionalDirector}                  | ${true}
      ${Role.StaffMember}                       | ${true}
      ${Role.Translator}                        | ${false}
    `('$role', ({ role, globalCanList }) => {
      it(`Global canList: ${globalCanList as string}`, async () => {
        const read = await runInIsolatedSession(app, async () => {
          await registerUser(app, { roles: role });
          return await listFundingAccounts(app);
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
