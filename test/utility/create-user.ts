import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate, isValid } from 'shortid';
import { CreateUser, User } from '../../src/components/user';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createUser(app: TestApp, password: string) {
  const user: CreateUser = {
    email: `email_${generate}@test.com`,
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName(),
    displayLastName: faker.name.lastName(),
    password,
    phone: faker.phone.phoneNumber(),
    timezone: 'timezone detail',
    bio: 'bio detail',
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
    }
  );

  const actual: User = result.createUser.user;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.email.value).toBe(user.email);

  return actual;
}
