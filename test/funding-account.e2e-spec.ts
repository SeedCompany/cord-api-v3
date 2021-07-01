import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { generateId, isValidId } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { FundingAccount } from '../src/components/funding-account';
import {
  createFundingAccount,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('FundingAccount e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(app, [Powers.CreateFundingAccount]);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  // Create Funding Account
  it('create funding account', async () => {
    const name = faker.company.companyName();
    await createFundingAccount(app, { name });
  });

  // Read Funding Account
  it('create & read funding account by id', async () => {
    const st = await createFundingAccount(app);

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
    const st = await createFundingAccount(app);
    const newName = faker.company.companyName();
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
    const st = await createFundingAccount(app);
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
    const numFundingAccounts = 2;
    await Promise.all(
      times(numFundingAccounts).map(
        async () =>
          await createFundingAccount(app, {
            name: (await generateId()) + ' Funding',
          })
      )
    );

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
