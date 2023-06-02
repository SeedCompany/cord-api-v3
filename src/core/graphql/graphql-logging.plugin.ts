import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestContext as RequestContext,
  GraphQLRequestListener as RequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GraphQLError } from 'graphql';
import { isNeo4jError } from '~/core';
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
    if (isNeo4jError(error.originalError)) {
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
