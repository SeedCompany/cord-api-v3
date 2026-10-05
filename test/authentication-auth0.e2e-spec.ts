import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { type ID } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { graphql } from '~/graphql';
import {
  currentUser,
  loginWithAuth0,
  logout,
  registerUser,
} from './operations/auth';
import {
  createApp,
  createTester,
  getRootTester,
  type TestApp,
  type Tester,
} from './setup';

describe('Authentication via Auth0 e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createApp();
  });

  const claimsFor = (
    email: string,
    overrides?: Partial<Auth0Claims>,
  ): Auth0Claims => ({
    sub: `auth0|${faker.string.uuid()}`,
    email,
    emailVerified: true,
    givenName: faker.person.firstName(),
    familyName: faker.person.lastName(),
    ...overrides,
  });

  it('logs in an existing user by matching email on first try', async () => {
    const tester = createTester(app);
    const user = await tester.apply(registerUser());
    await tester.apply(logout());

    const claims = claimsFor(user.email.value!);
    jest.spyOn(app.get(Auth0Service), 'verifyToken').mockResolvedValue(claims);

    const res = await tester.apply(loginWithAuth0({ idToken: 'fake-token' }));
    expect(res.user.id).toBe(user.id);
  });

  it('re-matches the same user by sub even when the claimed email changes', async () => {
    const tester = createTester(app);
    const user = await tester.apply(registerUser());
    await tester.apply(logout());

    const sub = `auth0|${faker.string.uuid()}`;

    const firstClaims = claimsFor(user.email.value!, { sub });
    jest
      .spyOn(app.get(Auth0Service), 'verifyToken')
      .mockResolvedValueOnce(firstClaims);
    const first = await tester.apply(loginWithAuth0({ idToken: 'fake-token' }));
    expect(first.user.id).toBe(user.id);

    await tester.apply(logout());

    // Second login: same sub, but a different (unassociated) email — proves
    // matching happens by sub first, not by re-deriving the user via email.
    const secondClaims = claimsFor(faker.internet.email(), { sub });
    jest
      .spyOn(app.get(Auth0Service), 'verifyToken')
      .mockResolvedValueOnce(secondClaims);
    const second = await tester.apply(
      loginWithAuth0({ idToken: 'fake-token' }),
    );
    expect(second.user.id).toBe(user.id);
  });

  it('JIT-provisions a brand-new user when no match exists by sub or email', async () => {
    const tester = createTester(app);

    const email = faker.internet.email();
    const claims = claimsFor(email, {
      givenName: 'Ada',
      familyName: 'Lovelace',
    });
    jest.spyOn(app.get(Auth0Service), 'verifyToken').mockResolvedValue(claims);

    const res = await tester.apply(loginWithAuth0({ idToken: 'fake-token' }));
    expect(res.user.id).toEqual(expect.any(String));

    const after = await tester.apply(currentUser());
    expect(after?.id).toBe(res.user.id);
  });

  it('rejects an invalid/unverifiable token as a GraphQL error', async () => {
    const tester = createTester(app);

    jest
      .spyOn(app.get(Auth0Service), 'verifyToken')
      .mockRejectedValue(new Error('signature verification failed'));

    await expect(
      tester.apply(loginWithAuth0({ idToken: 'not-a-real-token' })),
    ).rejects.toThrow();
  });

  it('refuses a disabled user via the Auth0 path, same as the password path', async () => {
    const tester = createTester(app);
    const admin = await getRootTester(app);
    const user = await tester.apply(registerUser());
    await admin.apply(disableUser(user.id));

    const claims = claimsFor(user.email.value!);
    jest.spyOn(app.get(Auth0Service), 'verifyToken').mockResolvedValue(claims);

    await expect(
      tester.apply(loginWithAuth0({ idToken: 'fake-token' })),
    ).rejects.toThrowGqlError({
      message: 'User is disabled',
      code: ['UserDisabled', 'Authentication', 'Client'],
    });
  });

  it('refuses a deleted user via the Auth0 path, same as the password path', async () => {
    const tester = createTester(app);
    const admin = await getRootTester(app);
    const user = await tester.apply(registerUser());
    const email = user.email.value!;
    await admin.apply(deleteUser(user.id));

    const claims = claimsFor(email);
    jest.spyOn(app.get(Auth0Service), 'verifyToken').mockResolvedValue(claims);

    await expect(
      tester.apply(loginWithAuth0({ idToken: 'fake-token' })),
    ).rejects.toThrowGqlError({
      message: 'Invalid credentials',
    });
  });
});

const deleteUser = (userId: ID) => async (tester: Tester) => {
  await tester.run(
    graphql(`
      mutation DeleteUserForAuth0Spec($id: ID!) {
        deleteUser(id: $id) {
          __typename
        }
      }
    `),
    { id: userId },
  );
};

const disableUser = (userId: ID) => async (tester: Tester) => {
  await tester.run(
    graphql(`
      mutation DisableUserForAuth0Spec($id: ID!) {
        updateUser(input: { id: $id, status: Disabled }) {
          __typename
        }
      }
    `),
    { id: userId },
  );
};
