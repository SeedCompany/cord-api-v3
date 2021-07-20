import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generateId, isValidId } from '../../src/common';
import { RegisterInput } from '../../src/components/authentication';
import { Powers } from '../../src/components/authorization/dto/powers';
import { Role } from '../../src/components/project';
import { User, UserStatus } from '../../src/components/user';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { grantPower } from './grant-power';
import { runAsAdmin } from './login';

export const generateRegisterInput = async (): Promise<RegisterInput> => ({
  ...(await generateRequireFieldsRegisterInput()),
  phone: faker.phone.phoneNumber(),
  about: 'about detail',
  status: UserStatus.Active,
  roles: [Role.ProjectManager, Role.Consultant],
  title: faker.name.title(),
});

export const generateRequireFieldsRegisterInput =
  async (): Promise<RegisterInput> => ({
    email: faker.internet.email(),
    realFirstName: faker.name.firstName(),
    realLastName: faker.name.lastName(),
    displayFirstName: faker.name.firstName() + (await generateId()),
    displayLastName: faker.name.lastName() + (await generateId()),
    password: faker.internet.password(10),
    timezone: 'America/Chicago',
  });

export async function registerUserWithStrictInput(
  app: TestApp,
  input: RegisterInput
) {
  const user: RegisterInput = {
    ...input,
  };
  const result = await app.graphql.mutate(
    gql`
      mutation createUser($input: RegisterInput!) {
        register(input: $input) {
          user {
            ...user
          }
        }
      }
      ${fragments.user}
    `,
    {
      input: user,
    }
  );
  const actual: User = result.register.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.email.value).toBe(input.email.toLowerCase());

  return actual;
}
export async function registerUser(
  app: TestApp,
  input: Partial<RegisterInput> = {}
) {
  const { roles, ...user }: RegisterInput = {
    ...(await generateRegisterInput()),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createUser($input: RegisterInput!) {
        register(input: $input) {
          user {
            ...user
          }
        }
      }
      ${fragments.user}
    `,
    {
      input: user,
    }
  );
  const actual: User = result.register.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.email.value).toBe(user.email.toLowerCase());

  // Add roles to user as admin as we are assuming this is a fixture setup
  // instead of actually trying to create a user the intended way.
  if (roles && roles.length > 0) {
    await runAsAdmin(app, async () => {
      await app.graphql.mutate(
        gql`
          mutation AddRolesToUser($userId: ID!, $roles: [Role!]!) {
            updateUser(input: { user: { id: $userId, roles: $roles } }) {
              __typename
            }
          }
        `,
        {
          userId: actual.id,
          roles,
        }
      );
    });
  }

  return actual;
}

export async function registerUserWithPower(
  app: TestApp,
  powers: Powers[],
  input: Partial<RegisterInput> = {}
): Promise<User> {
  const user = await registerUser(app, input);
  await grantPower(app, user.id, ...powers);
  return user;
}
