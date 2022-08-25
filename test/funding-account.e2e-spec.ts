import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import { times } from 'lodash';
import { isValidId } from '../src/common';
import { Role } from '../src/components/authorization/dto/role.dto';
import { FundingAccount } from '../src/components/funding-account';
import {
  createFundingAccount,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  runAsAdmin,
  TestApp,
} from './utility';

describe('FundingAccount e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.LeadFinancialAnalyst] });
    //todo
    // [Powers.CreateFundingAccount]
  });

  afterAll(async () => {
    await app.close();
  });

  // Create Funding Account
  it('create funding account', async () => {
    await runAsAdmin(app, createFundingAccount);
  });

  // Read Funding Account
  it('create & read funding account by id', async () => {
    const st = await runAsAdmin(app, createFundingAccount);

    const { fundingAccount: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          fundingAccount(id: $id) {
            ...fundingAccount
          }
        }
        ${fragments.fundingAccount}
      `,
      {
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
    expect(actual.accountNumber.value).toBe(st.accountNumber.value);
  });

  // Update FundingAccount
  it('update funding account', async () => {
    const st = await runAsAdmin(app, createFundingAccount);
    const newName = faker.company.name();
    const newAccountNumber = faker.datatype.number({ min: 0, max: 9 });
    await runAsAdmin(app, async () => {
      const result = await app.graphql.mutate(
        gql`
          mutation updateFundingAccount($input: UpdateFundingAccountInput!) {
            updateFundingAccount(input: $input) {
              fundingAccount {
                ...fundingAccount
              }
            }
          }
          ${fragments.fundingAccount}
        `,
        {
          input: {
            fundingAccount: {
              id: st.id,
              name: newName,
              accountNumber: newAccountNumber,
            },
          },
        }
      );
      const updated = result.updateFundingAccount.fundingAccount;
      expect(updated).toBeTruthy();
      expect(updated.name.value).toBe(newName);
      expect(updated.accountNumber.value).toBe(newAccountNumber);
    });
  });

  // Delete FundingAccount
  it.skip('delete funding account', async () => {
    const st = await runAsAdmin(app, createFundingAccount);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteFundingAccount($id: ID!) {
          deleteFundingAccount(id: $id) {
            __typename
          }
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: FundingAccount | undefined = result.deleteFundingAccount;
    expect(actual).toBeTruthy();
  });

  // List FundingAccounts
  it('list view of funding accounts', async () => {
    // create a bunch of funding accounts
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    const numFundingAccounts = 2;
    await Promise.all(
      times(numFundingAccounts).map(async () => {
        return await createFundingAccount(app); // can't runInSession here, creates problems
      })
    );
    await registerUser(app, { roles: [Role.LeadFinancialAnalyst] });

    const { fundingAccounts } = await app.graphql.query(gql`
      query {
        fundingAccounts(input: { count: 15 }) {
          items {
            ...fundingAccount
          }
          hasMore
          total
        }
      }
      ${fragments.fundingAccount}
    `);

    expect(fundingAccounts.items.length).toBeGreaterThanOrEqual(
      numFundingAccounts
    );
  });
});
