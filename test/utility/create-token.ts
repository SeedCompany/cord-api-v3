import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

export async function createToken(app: TestApp): Promise<string> {
  const result = await app.graphql.mutate(gql`
    mutation {
      createToken {
        token
      }
    }
  `);
  const token = result.createToken?.token;
  expect(token).toBeTruthy();
  app.graphql.authToken = token;

  console.log('Token created: ' + token);

  return token;
}
