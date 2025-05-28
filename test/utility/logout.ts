import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

export async function logout(app: TestApp) {
  return await app.graphql.mutate(
    graphql(`
      mutation {
        logout {
          __typename
        }
      }
    `),
  );
}
