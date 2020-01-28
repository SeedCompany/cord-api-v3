import { gql } from 'apollo-server-core';
import { User } from 'src/components/user/user';
import { isValid } from 'shortid';
import { CreateUserInput } from '../../src/components/user/user.dto';
import { TestApp } from './create-app';
import * as faker from 'faker';
import { fragments } from './fragments';

export async function createUser(
  app: TestApp,
  input: Partial<CreateUserInput> = {},
) {
  const user: CreateUserInput = {
    email: faker.internet.email(),
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName(),
    displayLastName: faker.name.lastName(),
    password: faker.internet.password(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createUser($input: CreateUserInputDto!) {
        createUser(input: $input) {
          user {
            ...user
          }
        }
      }
      ${fragments.user}
    `,
    {
      input: {
        user,
      },
    },
  );

  const actual: User | undefined = result.createUser?.user;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.email).toBe(user.email);

  return actual;
}
