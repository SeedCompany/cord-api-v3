import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '~/core';
import {
  createExecute,
  type GqlExecute,
} from '../setup/gql-client/gql-execute';

export interface GraphQLTestClient {
  query: GqlExecute;
  mutate: GqlExecute;
  authToken: string;
  email?: string;
}

export const createGraphqlClient = async (
  app: INestApplication,
): Promise<GraphQLTestClient> => {
  await app.listen(0);
  const url = await app.getUrl();
  app.get(ConfigService).hostUrl$.next(new URL(url) as URL & string);

  let authToken = '';
  let email: string | undefined = undefined;

  const execute = createExecute({
    url,
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
