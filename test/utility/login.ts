import { jest } from '@jest/globals';
import { generateId } from '~/common';
import {
  type Auth0Claims,
  Auth0Service,
} from '~/core/authentication/auth0.service';
import { ConfigService } from '~/core/config';
import { graphql } from '~/graphql';
import { type TestApp } from './create-app';
import { createSession } from './create-session';

/**
 * Logs the current session in as the user with this email, by
 * JIT/re-provisioning them through `loginWithAuth0` with a stubbed
 * `Auth0Service.verifyToken` rather than the retired password `login`
 * mutation. There's no password anymore, so that's all this needs.
 *
 * @deprecated use multiple {@link import('../setup').Tester} instead
 */
export async function login(app: TestApp, input: { email: string }) {
  const claims: Auth0Claims = {
    sub: `test|${await generateId()}`,
    email: input.email,
    emailVerified: true,
  };
  jest
    .spyOn(app.get(Auth0Service), 'verifyToken')
    .mockResolvedValueOnce(claims);

  const res = await app.graphql.mutate(LoginWithAuth0Doc, {
    input: { idToken: `test-token-${claims.sub}` },
  });
  app.graphql.email = input.email;
  return res;
}
export const LoginWithAuth0Doc = graphql(`
  mutation loginWithAuth0ForLogin($input: LoginWithAuth0Input!) {
    loginWithAuth0(input: $input) {
      user {
        id
      }
    }
  }
`);

/** @deprecated use an admin tester instead  */
export const loginAsAdmin = async (app: TestApp) => {
  const { email } = app.get(ConfigService).rootUser;
  await login(app, { email });
};

/** @deprecated use an admin tester instead  */
export const runAsAdmin = async <R>(
  app: TestApp,
  adminExecution: (app: TestApp) => Promise<R> | R,
) =>
  await runInIsolatedSession(app, async () => {
    await loginAsAdmin(app);
    return await adminExecution(app);
  });

/** @deprecated use multiple {@link import('../setup').Tester} instead  */
export const runInIsolatedSession = async <R>(
  app: TestApp,
  execution: () => Promise<R> | R,
): Promise<R> => {
  const currentSession = app.graphql.authToken;
  app.graphql.authToken = ''; // reset to no session
  try {
    await createSession(app); // create isolated session
    return await execution();
  } finally {
    // revert to previously defined session
    app.graphql.authToken = currentSession;
  }
};
