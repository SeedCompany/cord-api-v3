/**
 * Unit-style tests for the test utilities in create-session.ts.
 *
 * These tests exercise the changed logic in getUserFromSession without
 * spinning up the full NestJS application. The TestApp is mocked with a
 * minimal stub of app.graphql.query.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { CurrentUserDoc, getUserFromSession } from './create-session';

// ---------------------------------------------------------------------------
// Minimal TestApp stub
// ---------------------------------------------------------------------------

function makeApp(queryResult: Record<string, any>) {
  return {
    graphql: {
      authToken: undefined as string | undefined,
      query: jest.fn<() => Promise<any>>().mockResolvedValue(queryResult),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// getUserFromSession
// ---------------------------------------------------------------------------

describe('getUserFromSession', () => {
  it('returns an object with the session user id when authenticated', async () => {
    const app = makeApp({ session: { user: { id: 'user-abc-123' } } });

    const result = await getUserFromSession(app);

    expect(result).toEqual({ id: 'user-abc-123' });
  });

  it('throws an error when session user is null', async () => {
    const app = makeApp({ session: { user: null } });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws an error when session user is undefined', async () => {
    const app = makeApp({ session: { user: undefined } });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws an error when session user exists but has no id', async () => {
    const app = makeApp({ session: { user: { id: undefined } } });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws an error when session user id is an empty string', async () => {
    const app = makeApp({ session: { user: { id: '' } } });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('queries using the CurrentUserDoc document', async () => {
    const app = makeApp({ session: { user: { id: 'user-xyz' } } });

    await getUserFromSession(app);

    expect(app.graphql.query).toHaveBeenCalledWith(
      CurrentUserDoc,
      expect.anything(),
    );
  });

  it('returns only the id, not any additional fields from the session', async () => {
    // Even if the server returns extra fields, the function strips them.
    const app = makeApp({
      session: { user: { id: 'user-123', email: 'x@y.com', roles: ['Admin'] } },
    });

    const result = await getUserFromSession(app);

    expect(result).toEqual({ id: 'user-123' });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('roles');
  });
});
