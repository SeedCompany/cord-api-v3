import { gql } from 'apollo-server-core';
import { LoginInput } from '../../src/components/authentication/authentication.dto';
import { ConfigService } from '../../src/core';
import { TestApp } from './create-app';
import { createSession } from './create-session';

export async function login(app: TestApp, input: Partial<LoginInput> = {}) {
  return await app.graphql.mutate(
    gql`
      mutation login($input: LoginInput!) {
        login(input: $input) {
          user {
            id
          }
        }
      }
    `,
    { input }
  );
}

export const loginAsAdmin = async (app: TestApp) => {
  const { email, password } = app.get(ConfigService).rootAdmin;
  await login(app, { email, password });
};

export const runAsAdmin = async (
  app: TestApp,
  adminExecution: () => Promise<void> | void
) => {
  const currentSession = app.graphql.authToken;
  app.graphql.authToken = ''; // reset to no session
  try {
    await createSession(app); // create admin session
    await loginAsAdmin(app);
    await adminExecution();
  } finally {
    // revert to previously defined session
    app.graphql.authToken = currentSession;
  }
};
