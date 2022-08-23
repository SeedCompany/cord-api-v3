import { INestApplicationContext } from '@nestjs/common';
import { GqlModuleOptions, GraphQLModule } from '@nestjs/graphql';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { ApolloServerBase } from 'apollo-server-core';
import { GraphQLResponse } from 'apollo-server-types';
import { DocumentNode, GraphQLFormattedError } from 'graphql';
import { GqlContextType } from '../../src/common';
import { TracingService } from '../../src/core';
import { GqlContextHostImpl } from '../../src/core/graphql/gql-context.host';
import { createFakeStubOperation } from '../../src/core/graphql/graphql.config';

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

  const resetRequest = () => {
    // Session data changes between requests
    // Next request shouldn't rely on previously calculated data.
    // It doesn't when using actual requests.
    if (options.context?.session) {
      delete options.context.session;
    }
  };

  // ensure variables are plain JSON as they would be over the wire
  const toPlain = (obj: unknown) =>
    obj ? JSON.parse(JSON.stringify(obj)) : obj;

  const tracing = app.get(TracingService);
  const contextHost = app.get(GqlContextHostImpl);
  return {
    query: async (q, variables) => {
      return await contextHost.attachScope(async () => {
        return await tracing.capture('query', async () => {
          try {
            const result = await server.executeOperation({
              query: q,
              variables: toPlain(variables),
            });
            validateResult(result);
            return result.data;
          } catch (e) {
            throw adjustError(e);
          } finally {
            resetRequest();
          }
        });
      });
    },
    mutate: async (mutation, variables) => {
      return await contextHost.attachScope(async () => {
        return await tracing.capture('mutation', async () => {
          try {
            const result = await server.executeOperation({
              query: mutation,
              variables: toPlain(variables),
            });
            validateResult(result);
            return result.data;
          } catch (e) {
            throw adjustError(e);
          } finally {
            resetRequest();
          }
        });
      });
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
      // @ts-expect-error yes I know this is a fake request
      options.context.request = {
        headers: {
          ...(token && {
            authorization: `Bearer ${token}`,
          }),
        },
      };
    },
  };
};

function validateResult(res: GraphQLResponse): asserts res is Omit<
  GraphQLResponse,
  'data' | 'errors'
> & {
  data: Record<string, any>;
} {
  if (res.errors && res.errors.length > 0) {
    throw reportError(res.errors[0]);
  }
  expect(res.data).toBeTruthy();
}

const adjustError = (e: Error) => {
  if (e.stack) {
    const thisStack = new Error('').stack?.split('\n').slice(2);
    if (thisStack) {
      e.stack += '\n' + thisStack.join('\n');
    }
  }
  return e;
};

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

export const getGraphQLOptions = (): GqlModuleOptions => {
  const context: GqlContextType = {
    operation: createFakeStubOperation(),
  };
  return {
    path: '/graphql',
    fieldResolverEnhancers: [],
    autoSchemaFile: 'schema.graphql',
    context,
  };
};

const getServer = async (app: INestApplicationContext) => {
  const module = app.get(GraphQLModule);
  return (module as any).apolloServer as ApolloServerBase;
};
