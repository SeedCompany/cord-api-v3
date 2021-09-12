import { Plugin } from '@nestjs/graphql';
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
  constructor(
    @Logger('graphql') private readonly logger: ILogger,
    @Logger('graphql:performance') private readonly perfLogger: ILogger
  ) {}

  async requestDidStart(
    _context: RequestContext<ContextType>
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
      willSendResponse: async ({ operationName, request, response }) => {
        if (response.errors || operationName === 'IntrospectionQuery') {
          return;
        }

        // No longer available with apollo server v3
        const tracing: any | undefined = response.extensions?.tracing;
        if (!tracing) {
          return;
        }

        this.perfLogger.info(`Operation performance`, {
          operation: operationName,
          duration: nanoToMs(tracing.duration),
          ...maskSecrets(request.variables ?? {}),
        });
        for (const resolver of tracing.execution.resolvers) {
          const ms = nanoToMs(resolver.duration);
          // Assume >10ms we have logic for the field
          if (ms < 10) {
            continue;
          }
          this.perfLogger.info(`Resolver performance`, {
            resolver: [resolver.parentType, resolver.fieldName].join('.'),
            path: resolver.path.join('.'),
            duration: ms,
          });
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

const nanoToMs = (value: number) => ~~(value / 1e6);
