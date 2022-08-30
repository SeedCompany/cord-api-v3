import { TestApp } from './create-app';
import { gql } from './gql-tag';

export async function logout(app: TestApp) {
  return await app.graphql.mutate(
    gql`
      mutation {
        logout {
          __typename
        }
      }
    `
  );
}
