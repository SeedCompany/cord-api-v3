/**
 * Unit-style tests for the create-session utility helpers.
 *
 * These tests run under the E2E Jest project (roots=['test']) but use only
 * mocked objects so no real database or application is needed.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getUserFromSession } from './create-session';

const makeApp = (sessionUserPayload: unknown) =>
  ({
    graphql: {
      query: jest.fn<() => Promise<any>>().mockResolvedValue({
        session: sessionUserPayload,
      }),
    },
  }) as any;

describe('getUserFromSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an object with the user id when the session has a logged-in user', async () => {
    const app = makeApp({ user: { id: 'user-abc-123' } });

    const result = await getUserFromSession(app);

    expect(result).toEqual({ id: 'user-abc-123' });
  });

  it('throws when the session user is null (unauthenticated session)', async () => {
    const app = makeApp({ user: null });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws when the session user object is missing an id', async () => {
    const app = makeApp({ user: {} });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws when the session user id is an empty string', async () => {
    const app = makeApp({ user: { id: '' } });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('throws when the session user is undefined', async () => {
    const app = makeApp({ user: undefined });

    await expect(getUserFromSession(app)).rejects.toThrow(
      'Expected session user to be present',
    );
  });

  it('returns only id regardless of extra properties on the session user', async () => {
    const app = makeApp({
      user: { id: 'user-xyz', email: 'user@example.com', roles: ['Admin'] },
    });

    const result = await getUserFromSession(app);

    // Result is shaped as SessionUser, which only has id.
    expect(result).toEqual({ id: 'user-xyz' });
    expect(Object.keys(result)).toEqual(['id']);
  });

  it('passes an empty-object variables argument to app.graphql.query', async () => {
    const app = makeApp({ user: { id: 'user-abc' } });

    await getUserFromSession(app);

    // The second argument to query() must be {} (not undefined) so the
    // typed GraphQL client does not complain about missing variables.
    expect(app.graphql.query).toHaveBeenCalledWith(
      expect.anything(),
      {},
    );
  });
});
