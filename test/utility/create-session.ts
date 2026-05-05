import { expect } from '@jest/globals';
import { type ID } from '~/common';
import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

interface SessionUser {
  id: ID;
}

/**
 * Creates a test session and stores the returned token on the app's GraphQL client.
 *
 * This performs the SessionToken query, assigns the returned token to `app.graphql.authToken`,
 * and verifies a token was received.
 *
 * @returns The session token string
 */
export async function createSession(app: TestApp) {
  const result = await app.graphql.query(
    graphql(`
      query SessionToken {
        session {
          token
        }
      }
    `),
    {},
  );
  const token = result.session.token;
  expect(token).toBeTruthy();
  app.graphql.authToken = token!;
  return token;
}

/**
 * Return the current session user or throw if the session is unauthenticated.
 *
 * @returns An object with the session user's `id`.
 * @throws Error if no authenticated session user is present.
 */
export async function getUserFromSession(app: TestApp): Promise<SessionUser> {
  const result = await app.graphql.query(CurrentUserDoc, {});
  const user = result.session.user;
  if (!user?.id) {
    throw new Error('Expected session user to be present');
  }
  return { id: user.id };
}
export const CurrentUserDoc = graphql(`
  query SessionUser {
    session {
      user {
        id
      }
    }
  }
`);
