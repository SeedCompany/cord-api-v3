import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate, isValid } from 'shortid';
import { CreateUser, User } from '../../src/components/user';
import { UserStatus } from '../../src/components/user/dto/user-status.enum';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createUser(
  app: TestApp,
  input: Partial<CreateUser> = {}
) {
  const user: CreateUser = {
    email: `${faker.internet.email()} ${Date.now()}`,
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName() + generate(),
    displayLastName: faker.name.lastName() + generate(),
    password: faker.internet.password(),
    phone: faker.phone.phoneNumber(),
    timezone: 'timezone detail' + generate(),
    bio: 'bio detail' + generate(),
    status: UserStatus.Active,
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
