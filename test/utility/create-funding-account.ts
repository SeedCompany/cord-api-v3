import { faker } from '@faker-js/faker';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createFundingAccount(
  app: TestApp,
  input: Partial<InputOf<typeof CreateFundingAccountDoc>> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();
  const accountNumber =
    input.accountNumber || faker.number.int({ min: 0, max: 9 });

  const result = await app.graphql.mutate(CreateFundingAccountDoc, {
    input: {
      ...input,
      name,
      accountNumber,
    },
  });
  const st = result.createFundingAccount.fundingAccount;

  expect(st).toBeTruthy();

  return st;
}

const CreateFundingAccountDoc = graphql(
  `
    mutation createFundingAccount($input: CreateFundingAccount!) {
      createFundingAccount(input: { fundingAccount: $input }) {
        fundingAccount {
          ...fundingAccount
        }
      }
    }
  `,
  [fragments.fundingAccount],
);
