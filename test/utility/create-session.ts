import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

export async function createSession(app: TestApp): Promise<string> {
  const result = await app.graphql.mutate(gql`
    mutation {
      createSession {
        token
      }
    }
  `);
  const token = result.createSession?.token;
  expect(token).toBeTruthy();
  app.graphql.authToken = token;
  return token;
}
