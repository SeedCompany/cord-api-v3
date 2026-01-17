import { many, type Many } from '@seedcompany/common';
import type { Role } from '~/common';
import { graphql } from '~/graphql';
import { registerUser } from '../../operations/auth';
import { type user } from '../../utility/fragments';
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
  const identity = await tester.apply(registerUser());
  const root = await getRootTester(app);
  await root.run(AddRolesToUser, {
    userId: identity.id,
    roles: many(role).slice(),
  });
  return Object.assign(Object.create(tester) as Tester, { identity });
};

const AddRolesToUser = graphql(`
  mutation AddRolesToUser($userId: ID!, $roles: [Role!]!) {
    updateUser(input: { id: $userId, roles: $roles }) {
      __typename
    }
  }
`);
