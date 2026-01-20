import { cacheable } from '@seedcompany/common';
import { ConfigService } from '~/core';
import { login } from '../../operations/auth';
import type { TestApp } from '../create-app';
import { createTester } from './graphql-tester';

/**
 * Get a tester for the root admin user.
 * Probably don't use this directly.
 */
export const getRootTester = cacheable(async (app: TestApp) => {
  const root = createTester(app);
  const { email, password } = app.get(ConfigService).rootUser;
  const { user } = await root.apply(login({ email, password }));
  return Object.assign(root, { identity: user });
})(new WeakMap());
