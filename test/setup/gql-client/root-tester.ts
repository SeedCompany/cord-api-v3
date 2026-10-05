import { jest } from '@jest/globals';
import { cacheable } from '@seedcompany/common';
import { generateId } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { ConfigService } from '~/core/config';
import { loginWithAuth0 } from '../../operations/auth';
import type { TestApp } from '../create-app';
import { createTester } from './graphql-tester';

/**
 * Get a tester for the root admin user.
 * Probably don't use this directly.
 */
export const getRootTester = cacheable(async (app: TestApp) => {
  const root = createTester(app);
  const { email } = app.get(ConfigService).rootUser;

  // Root's `users` row already exists (created at boot by the passwordless
  // setupRootUser()), so this is just the ordinary "existing user, match by
  // email" path through loginWithAuth0 — nothing root-specific needed here.
  const claims: Auth0Claims = {
    sub: `root|${await generateId()}`,
    email,
    emailVerified: true,
  };
  jest
    .spyOn(app.get(Auth0Service), 'verifyToken')
    .mockResolvedValueOnce(claims);

  await root.apply(loginWithAuth0({ idToken: 'root-test-token' }));
  return root;
})(new WeakMap());
