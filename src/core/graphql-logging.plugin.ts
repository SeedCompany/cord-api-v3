import { Plugin } from '@nestjs/graphql';
import { GraphQLRequestContext } from 'apollo-server-core';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from 'apollo-server-plugin-base';
import { GraphQLError } from 'graphql';
import { ILogger, Logger } from './logger';

/**
 * Logging for GraphQL errors that are not handled anywhere else
 * Note: Lot's of assumptions here.
 */
@Plugin()
export class GraphqlLoggingPlugin implements ApolloServerPlugin {
  constructor(@Logger('graphql') private readonly logger: ILogger) {}

  requestDidStart(
    _context: GraphQLRequestContext
  ): GraphQLRequestListener | void {
    return {
      didEncounterErrors: ({ errors }) => {
        for (const error of errors) {
          this.onError(error);
        }
      },
    };
  }

  private onError(error: GraphQLError) {
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
