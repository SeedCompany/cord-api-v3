import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

export async function logout(app: TestApp) {
  return app.graphql.mutate(
    gql`
      mutation {
        logout
      }
    `
  );
}
