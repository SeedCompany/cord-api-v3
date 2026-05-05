import { expect } from '@jest/globals';
import { type ID } from '~/common';
import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

interface SessionUser {
  id: ID;
}

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
 * Return the current session user and fail fast if the session is unauthenticated.
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
