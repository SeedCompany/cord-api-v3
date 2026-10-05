import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { many, type Many } from '@seedcompany/common';
import { generateId, type Role } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { graphql } from '~/graphql';
import { initSessionOnce } from '../../operations/auth';
import { type user } from '../../utility/fragments';
import * as fragments from '../../utility/fragments';
import type { TestApp } from '../create-app';
import { createTester, type Tester } from './graphql-tester';
import { getRootTester } from './root-tester';

export interface IdentifiedTester extends Tester {
  identity: user;
}

export const createTesterWithRole = async (
  app: TestApp,
  role: Many<Role>,
): Promise<IdentifiedTester> => {
  const tester = createTester(app);

  // JIT-provision a brand-new user via loginWithAuth0 (stubbing
  // Auth0Service.verifyToken for this one call) instead of the retired
  // password `register` mutation.
  const claims: Auth0Claims = {
    sub: `test|${await generateId()}`,
    email: faker.internet.email(),
    emailVerified: true,
    givenName: faker.person.firstName(),
    familyName: faker.person.lastName(),
  };
  jest
    .spyOn(app.get(Auth0Service), 'verifyToken')
    .mockResolvedValueOnce(claims);
  await tester.apply(initSessionOnce());
  const loggedIn = await tester.run(LoginWithAuth0Doc, {
    input: { idToken: `test-token-${claims.sub}` },
  });
  const identity = loggedIn.loginWithAuth0.user;

  const root = await getRootTester(app);
  await root.run(AddRolesToUser, {
    userId: identity.id,
    roles: many(role).slice(),
  });
  return Object.assign(Object.create(tester) as Tester, { identity });
};

const LoginWithAuth0Doc = graphql(
  `
    mutation LoginWithAuth0ForTesterWithRole($input: LoginWithAuth0Input!) {
      loginWithAuth0(input: $input) {
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
    updateUser(input: { id: $userId, roles: $roles }) {
      __typename
    }
  }
`);
