import { INestApplicationContext } from '@nestjs/common';
import { GraphQLModule, GqlModuleOptions } from '@nestjs/graphql';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { ApolloServerBase } from 'apollo-server-core';
import { createTestClient } from 'apollo-server-testing';
import { GraphQLResponse } from 'apollo-server-types';
import { DocumentNode, GraphQLFormattedError } from 'graphql';

export interface GraphQLTestClient {
  query: (
    query: DocumentNode,
    variables?: { [name: string]: any },
  ) => Promise<Record<string, any>>;
  mutate: (
    mutation: DocumentNode,
    variables?: { [name: string]: any },
  ) => Promise<Record<string, any>>;
  authToken: string;
}

export const createGraphqlClient = async (
  app: INestApplicationContext,
): Promise<GraphQLTestClient> => {
  const server = await getServer(app);
  const options = app.get(GRAPHQL_MODULE_OPTIONS);
  const { query, mutate } = createTestClient(server);

  return {
    query: async (q, variables) => {
      const result = await query({ query: q, variables });
      validateResult(result);
      return result.data;
    },
    mutate: async (mutation, variables) => {
      const result = await mutate({ mutation, variables });
      validateResult(result);
      return result.data;
    },
    get authToken() {
      return options.context.token;
    },
    set authToken(token: string) {
      options.context.token = token;
    },
  };
};

const validateResult = (res: GraphQLResponse) => {
  if (res.errors && res.errors.length > 0) {
    throw reportError(res.errors[0]);
  }
  expect(res.data).toBeTruthy();
};

const reportError = (e: GraphQLFormattedError & { originalError?: Error }) => {
  if (e.originalError instanceof Error) {
    return e.originalError;
  }

  let msg =
    typeof e.message === 'object'
      ? JSON.stringify(e.message, undefined, 2)
      : e.message;
  if (e.path) {
    msg += `\nPath: ${e.path}`;
  }
  const location = (e.locations || [])
    .map(l => `  - line ${l.line}, column ${l.column}`)
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
  autoSchemaFile: 'schema.gql',
  context: {},
});

const getServer = async (app: INestApplicationContext) => {
  await app.init();
  const module = app.get(GraphQLModule);
  return (module as any).apolloServer as ApolloServerBase;
};
