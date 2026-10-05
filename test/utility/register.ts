import { faker } from '@faker-js/faker';
import { expect, jest } from '@jest/globals';
import { generateId, isValidId, Role } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { type CreatePersonDoc } from './create-person';
import * as fragments from './fragments';
import { login, runAsAdmin, runInIsolatedSession } from './login';

type RegisterUser = InputOf<typeof CreatePersonDoc>;

/** @deprecated */
export const generateRegisterInput = async () =>
  ({
    ...(await generateRequireFieldsRegisterInput()),
    phone: faker.phone.number(),
    about: 'about detail',
    status: 'Active',
    roles: [Role.ProjectManager, Role.Consultant],
    title: faker.person.jobTitle(),
  }) satisfies RegisterUser;

/** @deprecated */
export const generateRequireFieldsRegisterInput = async () =>
  ({
    email: faker.internet.email(),
    realFirstName: faker.person.firstName(),
    realLastName: faker.person.lastName(),
    displayFirstName: faker.person.firstName() + (await generateId()),
    displayLastName: faker.person.lastName() + (await generateId()),
    timezone: 'America/Chicago',
  }) satisfies RegisterUser;

/** @deprecated use {@link import('../setup').Tester} instead */
export type TestUser = fragments.user & {
  /**
   * Login as the user with the current session
   * @deprecated
   */
  login: () => Promise<void>;

  /**
   * Execute this code as this user in an isolated session
   * @deprecated
   */
  runAs: <R>(execution: () => Promise<R>) => Promise<R>;
};

/**
 * Creates a user by JIT-provisioning it through `loginWithAuth0` (stubbing
 * `Auth0Service.verifyToken` for the one call) instead of the retired
 * password `register` mutation. Defaults still come from
 * `generateRegisterInput()` merged under whatever the caller passed — same
 * as this always did — which is where the default `roles` (and the other
 * fixture fields: display name, phone, about, status, title) come from when
 * the caller doesn't specify them.
 *
 * JIT-provisioning itself only ever sets name/email and deliberately never
 * assigns roles (a real production safeguard, not a bug), so everything
 * else gets applied afterward via `updateUser` as admin — same end state
 * the retired `register` mutation produced in one shot.
 *
 * @deprecated use {@link import('../setup').createTesterWithRole} instead
 */
export async function registerUser(
  app: TestApp,
  input: Partial<RegisterUser> = {},
): Promise<TestUser> {
  const {
    email: emailInput,
    realFirstName,
    realLastName,
    ...rest
  } = {
    ...(await generateRegisterInput()),
    ...input,
  };
  const email = emailInput ?? faker.internet.email();

  const sub = `test|${await generateId()}`;
  const claims: Auth0Claims = {
    sub,
    email,
    emailVerified: true,
    givenName: realFirstName,
    familyName: realLastName,
  };
  jest
    .spyOn(app.get(Auth0Service), 'verifyToken')
    .mockResolvedValueOnce(claims);

  const result = await app.graphql.mutate(LoginWithAuth0Doc, {
    input: { idToken: `test-token-${sub}` },
  });
  const actual = result.loginWithAuth0.user;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.email.value).toBe(email.toLowerCase());

  await runAsAdmin(app, async () => {
    await app.graphql.mutate(UpdateUserForRegisterDoc, {
      input: { id: actual.id, ...rest },
    });
  });

  const loginMe = async () => {
    await login(app, { email });
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

const LoginWithAuth0Doc = graphql(
  `
    mutation RegisterUserViaAuth0($input: LoginWithAuth0Input!) {
      loginWithAuth0(input: $input) {
        user {
          ...user
        }
      }
    }
  `,
  [fragments.user],
);

const UpdateUserForRegisterDoc = graphql(`
  mutation UpdateUserForRegisterUser($input: UpdateUser!) {
    updateUser(input: $input) {
      __typename
    }
  }
`);
