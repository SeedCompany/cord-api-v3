import { gql } from 'graphql-tag';
import { TestApp } from './create-app';

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
