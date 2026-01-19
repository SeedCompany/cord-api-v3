import { createHttpClientForApp, type TestApp } from '../setup';
import {
  createExecute,
  type GqlExecute,
} from '../setup/gql-client/gql-execute';

/** @deprecated */
export interface GraphQLTestClient {
  query: GqlExecute;
  mutate: GqlExecute;
  authToken: string;
  email?: string;
}

/** @deprecated */
export const createGraphqlClient = (app: TestApp): GraphQLTestClient => {
  let authToken = '';
  let email: string | undefined = undefined;

  const http = createHttpClientForApp(app).extend({
    hooks: {
      beforeRequest: [
        (req) => {
          if (authToken) {
            req.headers.authorization = `Bearer ${authToken}`;
          }
        },
      ],
    },
  });
  const execute = createExecute(http);

  return {
    query: execute,
    mutate: execute,
    get authToken() {
      return authToken;
    },
    set authToken(token: string) {
      authToken = token;
    },
    get email() {
      return email;
    },
    set email(next: string | undefined) {
      email = next;
    },
  };
};
