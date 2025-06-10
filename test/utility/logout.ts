import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

export async function logout(app: TestApp) {
  return await app.graphql.mutate(LogoutDoc);
}
const LogoutDoc = graphql(`
  mutation Logout {
    logout {
      __typename
    }
  }
`);
