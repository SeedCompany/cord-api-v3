import { faker } from '@faker-js/faker';
import { gql } from 'graphql-tag';
import {
  CreateFundingAccount,
  FundingAccount,
} from '../../src/components/funding-account';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function listFundingAccounts(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        fundingAccounts(input: {}) {
          items {
            ...fundingAccount
          }
        }
      }
      ${fragments.fundingAccount}
    `
  );
  const fundingAccounts = result.fundingAccounts.items;
  expect(fundingAccounts).toBeTruthy();
  return fundingAccounts;
}

export async function readOneFundingAccount(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneFundingAccount($id: ID!) {
        fundingAccount(id: $id) {
          ...fundingAccount
        }
      }
      ${fragments.fundingAccount}
    `,
    { id }
  );
  const actual = result.fundingAccount;
  expect(actual).toBeTruthy();
  return actual;
}

export async function createFundingAccount(
  app: TestApp,
  input: Partial<CreateFundingAccount> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const accountNumber =
    input.accountNumber || faker.datatype.number({ min: 0, max: 9 });

  const result = await app.graphql.mutate(
    gql`
      mutation createFundingAccount($input: CreateFundingAccountInput!) {
        createFundingAccount(input: $input) {
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
          ...input,
          name,
          accountNumber,
        },
      },
    }
  );
  const st: FundingAccount = result.createFundingAccount.fundingAccount;

  expect(st).toBeTruthy();

  return st;
}
