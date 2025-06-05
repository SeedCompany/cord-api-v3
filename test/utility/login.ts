import { ConfigService } from '~/core';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createSession } from './create-session';

export async function login(app: TestApp, input: InputOf<typeof LoginDoc>) {
  const res = await app.graphql.mutate(LoginDoc, { input });
  app.graphql.email = input.email;
  return res;
}
const LoginDoc = graphql(`
  mutation login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
      }
    }
  }
`);

export const loginAsAdmin = async (app: TestApp) => {
  const { email, password } = app.get(ConfigService).rootUser;
  await login(app, { email, password });
};

export const runAsAdmin = async <R>(
  app: TestApp,
  adminExecution: (app: TestApp) => Promise<R> | R,
) =>
  await runInIsolatedSession(app, async () => {
    await loginAsAdmin(app);
    return await adminExecution(app);
  });

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
