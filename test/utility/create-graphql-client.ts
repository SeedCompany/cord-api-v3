import { INestApplicationContext } from '@nestjs/common';
import { GqlModuleOptions, GraphQLModule } from '@nestjs/graphql';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { ApolloServerBase } from 'apollo-server-core';
import { createTestClient } from 'apollo-server-testing';
import { GraphQLResponse } from 'apollo-server-types';
import { Request } from 'express';
import { DocumentNode, GraphQLFormattedError } from 'graphql';
import { GqlContextType } from '../../src/common';

export interface GraphQLTestClient {
  query: (
    query: DocumentNode,
    variables?: { [name: string]: any }
  ) => Promise<Record<string, any>>;
  mutate: (
    mutation: DocumentNode,
    variables?: { [name: string]: any }
  ) => Promise<Record<string, any>>;
  authToken: string;
}

export const createGraphqlClient = async (
  app: INestApplicationContext
): Promise<GraphQLTestClient> => {
  const server = await getServer(app);
  const options: GqlModuleOptions & { context: GqlContextType } = app.get(
    GRAPHQL_MODULE_OPTIONS
  );
  const { query, mutate } = createTestClient(server);

  const resetRequest = () => {
    // Session data changes between requests
    // Next request shouldn't rely on previously calculated data.
    // It doesn't when using actual requests.
    if (options.context?.request?.session) {
      delete options.context.request.session;
    }
  };

  // ensure variables are plain JSON as they would be over the wire
  const toPlain = (obj: unknown) =>
    obj ? JSON.parse(JSON.stringify(obj)) : obj;
  return {
    query: async (q, variables) => {
      const result = await query({ query: q, variables: toPlain(variables) });
      resetRequest();
      validateResult(result);
      return result.data;
    },
    mutate: async (mutation, variables) => {
      const result = await mutate({ mutation, variables: toPlain(variables) });
      resetRequest();
      validateResult(result);
      return result.data;
    },
    get authToken() {
      return (
        options.context.request?.headers?.authorization?.replace(
          'Bearer ',
          ''
        ) || ''
      );
    },
    set authToken(token: string) {
      const fakeRequest: Request = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;
      options.context.request = fakeRequest;
    },
  };
};

function validateResult(
  res: GraphQLResponse
): asserts res is Omit<GraphQLResponse, 'data' | 'errors'> & {
  data: Record<string, any>;
} {
  if (res.errors && res.errors.length > 0) {
    throw reportError(res.errors[0]);
  }
  expect(res.data).toBeTruthy();
}

const reportError = (
  e: GraphQLFormattedError & { originalError?: Error & { response?: any } }
) => {
  if (e.originalError instanceof Error) {
    const e2 = e.originalError;
    if (
      e2.response?.message &&
      e2.stack?.startsWith('Error: [object Object]\n')
    ) {
      e2.stack = e2.stack.replace('[object Object]', e2.response.message);
      e2.message = e2.response.message;
    }
    return e2;
  }

  let msg =
    typeof e.message === 'object'
      ? JSON.stringify(e.message, undefined, 2)
      : e.message;
  if (e.path) {
    msg += `\nPath: ${e.path.join('.')}`;
  }
  const location = (e.locations || [])
    .map((l) => `  - line ${l.line}, column ${l.column}`)
    .join('\n');
  if (location) {
    msg += `\nLocations:\n${location}`;
  }

  const err = new Error(msg);
  err.name = (e as any).name || 'Error';

  return err;
};

export const getGraphQLOptions = (): GqlModuleOptions => ({
  path: '/graphql',
  fieldResolverEnhancers: [],
  autoSchemaFile: 'schema.graphql',
  context: {},
});

const getServer = async (app: INestApplicationContext) => {
  const module = app.get(GraphQLModule);
  return (module as any).apolloServer as ApolloServerBase;
};
