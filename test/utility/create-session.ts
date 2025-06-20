import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

export async function createSession(app: TestApp) {
  const result = await app.graphql.query(
    graphql(`
      query SessionToken {
        session {
          token
        }
      }
    `),
  );
  const token = result.session.token;
  expect(token).toBeTruthy();
  app.graphql.authToken = token!;
  return token;
}

export async function getUserFromSession(app: TestApp) {
  const result = await app.graphql.query(CurrentUserDoc);
  const user = result.session.user;
  expect(user).toBeTruthy();
  return user!;
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
