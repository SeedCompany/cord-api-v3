import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate, isValid } from 'shortid';
import { CreateUser, User } from '../../src/components/user';
import { TestApp } from './create-app';
import { fragments } from './fragments';

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
];

export async function createUser(
  app: TestApp,
  input: Partial<CreateUser> = {}
) {
  const user: CreateUser = {
    email: faker.internet.email().replace('@', `.${generate()}@`),
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName(),
    displayLastName: faker.name.lastName(),
    password: faker.internet.password(),
    phone: faker.phone.phoneNumber(),
    timezone: faker.random.arrayElement(timezones),
    bio: faker.lorem.text(),
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
    }
  );

  const actual: User = result.createUser.user;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.email.value).toBe(user.email);

  return actual;
}
