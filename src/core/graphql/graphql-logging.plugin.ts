import { Plugin } from '@nestjs/apollo';
import { GraphQLRequestContext as RequestContext } from 'apollo-server-core';
import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestListener as RequestListener,
} from 'apollo-server-plugin-base';
import { GraphQLError } from 'graphql';
import { Neo4jError } from 'neo4j-driver';
import { GqlContextType as ContextType } from '../../common';
import { maskSecrets } from '../../common/mask-secrets';
import { ILogger, Logger } from '../logger';

/**
 * Logging for GraphQL errors that are not handled anywhere else
 * Note: Lots of assumptions here.
 */
@Plugin()
export class GraphqlLoggingPlugin implements ApolloPlugin<ContextType> {
  constructor(@Logger('graphql') private readonly logger: ILogger) {}

  async requestDidStart(
    _context: RequestContext<ContextType>,
  ): Promise<RequestListener<ContextType>> {
    return {
      executionDidStart: async ({ operationName, operation, request }) => {
        if (operationName === 'IntrospectionQuery') {
          return;
        }
        this.logger.info(`Received ${operation.operation}`, {
          operation: operationName,
          ...maskSecrets(request.variables ?? {}),
        });
      },
      didEncounterErrors: async ({ errors }) => {
        for (const error of errors) {
          this.onError(error);
        }
      },
    };
  }

  private onError(error: GraphQLError) {
    // Assume Neo4jErrors are already logged if they need to be.
    // For some reason they do not go through our ExceptionFilter.
    if (error.originalError instanceof Neo4jError) {
      return;
    }

    // Assume errors with extensions have already been logged by our ExceptionFilter
    // This means that these are native GraphQL errors
    if (error.extensions) {
      return;
    }

    const path = error.path?.join('.');
    const pathInfo = path ? { path } : {};

    if (!error.originalError) {
      // Assume client schema error.
      this.logger.warning('Invalid query', {
        error: error.message,
        ...pathInfo,
      });
      return;
    }

    // Assume server schema error.
    this.logger.error('Invalid response for GraphQL schema', {
      error: error.message,
      ...pathInfo,
    });
  }
}
