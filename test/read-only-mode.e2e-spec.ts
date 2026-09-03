import { beforeAll, describe, expect, it } from '@jest/globals';
import { graphql } from '~/graphql';
import {
  createOrganization,
  createSession,
  createTestApp,
  loginAsAdmin,
  type TestApp,
} from './utility';

/**
 * Read-only maintenance mode — the freeze for cutover day.
 *
 * With `READ_ONLY=true` (here: the `maintenance.readOnly` config override),
 * the API stays up so people can sign in and look at data, but every mutation
 * that would change data is refused with a `ReadOnlyMode` error. Signing in
 * and out keeps working: sessions are excluded from the cutover, so those
 * writes are outside the freeze — and reading requires being signed in.
 *
 * Run on both engines:
 *   yarn test:e2e --testPathPatterns read-only-mode
 *   DATABASE=postgres POSTGRES_URL=... yarn test:e2e --testPathPatterns read-only-mode
 */
describe('Read-only maintenance mode', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp({
      config: { maintenance: { readOnly: true } },
    });
    // The session query writes a token — deliberately not frozen.
    await createSession(app);
    // Signing in is a mutation that must keep working during the freeze;
    // if the mode caught it, this would throw and fail the suite right here.
    await loginAsAdmin(app);
  });

  it('still answers queries', async () => {
    const result = await app.graphql.query(
      graphql(`
        query WhoAmIDuringReadOnly {
          session {
            user {
              id
            }
          }
        }
      `),
    );
    expect(result.session.user?.id).toBeTruthy();
  });

  it('refuses a mutation that would change data', async () => {
    await expect(createOrganization(app)).rejects.toThrowGqlError({
      code: 'ReadOnlyMode',
      message: expect.stringContaining('read-only'),
    });
  });

  it('still allows signing out and back in', async () => {
    const result = await app.graphql.mutate(
      graphql(`
        mutation LogoutDuringReadOnly {
          logout {
            __typename
          }
        }
      `),
    );
    expect(result.logout.__typename).toBe('LoggedOut');
    await loginAsAdmin(app);
  });
});
