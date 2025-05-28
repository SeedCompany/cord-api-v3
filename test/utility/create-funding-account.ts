import { faker } from '@faker-js/faker';
import { graphql } from '~/graphql';
import { type CreateFundingAccount } from '../../src/components/funding-account/dto';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createFundingAccount(
  app: TestApp,
  input: Partial<CreateFundingAccount> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const accountNumber =
    input.accountNumber || faker.number.int({ min: 0, max: 9 });

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createFundingAccount($input: CreateFundingAccountInput!) {
          createFundingAccount(input: $input) {
            fundingAccount {
              ...fundingAccount
            }
          }
        }
      `,
      [fragments.fundingAccount],
    ),
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
  const st = result.createFundingAccount.fundingAccount;

  expect(st).toBeTruthy();

  return st;
}
