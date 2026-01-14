import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { generateId, isValidId, Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';
import { login, runAsAdmin, runInIsolatedSession } from './login';

type RegisterInput = InputOf<typeof RegisterUserDoc>;

export const generateRegisterInput = async () =>
  ({
    ...(await generateRequireFieldsRegisterInput()),
    phone: faker.phone.number(),
    about: 'about detail',
    status: 'Active',
    roles: [Role.ProjectManager, Role.Consultant],
    title: faker.person.jobTitle(),
  }) satisfies RegisterInput;

export const generateRequireFieldsRegisterInput = async () =>
  ({
    email: faker.internet.email(),
    realFirstName: faker.person.firstName(),
    realLastName: faker.person.lastName(),
    displayFirstName: faker.person.firstName() + (await generateId()),
    displayLastName: faker.person.lastName() + (await generateId()),
    password: faker.internet.password(),
    timezone: 'America/Chicago',
  }) satisfies RegisterInput;

export async function registerUserWithStrictInput(
  app: TestApp,
  input: RegisterInput,
) {
  const result = await app.graphql.mutate(RegisterUserDoc, { input });
  const actual = result.register.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.email.value).toBe(input.email.toLowerCase());

  return actual;
}

export type TestUser = fragments.user & {
  /**
   * Login as the user with the current session
   */
  login: () => Promise<void>;

  /**
   * Execute this code as this user in an isolated session
   */
  runAs: <R>(execution: () => Promise<R>) => Promise<R>;
};

export async function registerUser(
  app: TestApp,
  input: Partial<RegisterInput> = {},
): Promise<TestUser> {
  const { roles, ...user }: RegisterInput = {
    ...(await generateRegisterInput()),
    ...input,
  };

  const result = await app.graphql.mutate(RegisterUserDoc, { input: user });
  const actual = result.register.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.email.value).toBe(user.email.toLowerCase());

  // Add roles to user as admin as we are assuming this is a fixture setup
  // instead of actually trying to create a user the intended way.
  if (roles && roles.length > 0) {
    await runAsAdmin(app, async () => {
      await app.graphql.mutate(AddRolesToUser, {
        userId: actual.id,
        roles,
      });
    });
  }

  const loginMe = async () => {
    await login(app, { email: user.email, password: user.password });
  };
  return {
    ...actual,
    login: loginMe,
    runAs: <R>(execution: () => Promise<R>) =>
      runInIsolatedSession(app, async () => {
        await loginMe();
        return await execution();
      }),
  };
}

const RegisterUserDoc = graphql(
  `
    mutation RegisterUser($input: RegisterInput!) {
      register(input: $input) {
        user {
          ...user
        }
      }
    }
  `,
  [fragments.user],
);

const AddRolesToUser = graphql(`
  mutation AddRolesToUser($userId: ID!, $roles: [Role!]!) {
    updateUser(input: { user: { id: $userId, roles: $roles } }) {
      __typename
    }
  }
`);
