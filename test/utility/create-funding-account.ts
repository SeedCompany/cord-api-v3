import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreateFundingAccount,
  FundingAccount,
} from '../../src/components/funding-account';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createFundingAccount(
  app: TestApp,
  input: Partial<CreateFundingAccount> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();
  const accountNumber =
    input.accountNumber ||
    faker.random.number({ min: 1000, max: 9999 }).toString();

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
