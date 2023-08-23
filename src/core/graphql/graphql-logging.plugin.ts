import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestContext as RequestContext,
  GraphQLRequestListener as RequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GqlContextType as ContextType } from '~/common';
import { maskSecrets } from '~/common/mask-secrets';
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
    };
  }
}
