import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { CreateUser, User } from '../../src/components/user';
import { TestApp } from './create-app';
import * as faker from 'faker';
import { fragments } from './fragments';

export async function createUser(
  app: TestApp,
  input: Partial<CreateUser> = {},
) {
  const user: CreateUser = {
    email: faker.internet.email() + ' ' + Date.now(),
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName(),
    displayLastName: faker.name.lastName(),
    password: faker.internet.password(),
    phone: faker.phone.phoneNumber(),
    timezone: 'timezone detail',
    bio: 'bio detail',
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createUser($input: CreateUserInput!) {
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
  expect(actual.email.value).toBe(user.email);

  return actual;
}
