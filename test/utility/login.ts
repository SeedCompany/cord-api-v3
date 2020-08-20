import { gql } from 'apollo-server-core';
import { LoginInput } from '../../src/components/authentication/authentication.dto';
import { TestApp } from './create-app';

export async function login(app: TestApp, input: Partial<LoginInput> = {}) {
  return await app.graphql.mutate(
    gql`
      mutation login($input: LoginInput!) {
        login(input: $input) {
          user {
            id
          }
        }
      }
    `,
    { input }
  );
}
