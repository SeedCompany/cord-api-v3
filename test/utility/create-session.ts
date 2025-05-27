import { graphql } from '~/graphql';
import { type User } from '../../src/components/user/dto';
import { type TestApp } from './create-app';

export async function createSession(app: TestApp): Promise<string> {
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
  app.graphql.authToken = token;
  return token;
}

export async function getUserFromSession(app: TestApp): Promise<Partial<User>> {
  const result = await app.graphql.query(
    graphql(`
      query SessionUser {
        session {
          user {
            id
          }
        }
      }
    `),
  );
  const user = result.session.user;
  expect(user).toBeTruthy();
  return user;
}
