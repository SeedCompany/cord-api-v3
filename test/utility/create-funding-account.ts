import { faker } from '@faker-js/faker';
import {
  CreateFundingAccount,
  FundingAccount,
} from '../../src/components/funding-account/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function createFundingAccount(
  app: TestApp,
  input: Partial<CreateFundingAccount> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const accountNumber =
    input.accountNumber || faker.number.int({ min: 0, max: 9 });

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
    },
  );
  const st: FundingAccount = result.createFundingAccount.fundingAccount;

  expect(st).toBeTruthy();

  return st;
}
