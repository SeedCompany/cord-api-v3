import { User } from '../../src/components/user';
import { TestApp } from './create-app';
import { gql } from './gql-tag';

export async function createSession(app: TestApp): Promise<string> {
  const result = await app.graphql.query(gql`
    query {
      session {
        token
      }
    }
  `);
  const token = result.session.token;
  expect(token).toBeTruthy();
  app.graphql.authToken = token;
  return token;
}

export async function getUserFromSession(app: TestApp): Promise<Partial<User>> {
  const result = await app.graphql.query(gql`
    query {
      session {
        user {
          id
        }
      }
    }
  `);
  const user = result.session.user;
  expect(user).toBeTruthy();
  return user;
}
