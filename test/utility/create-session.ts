import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

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
