import {
  OnExecuteEventPayload as OnExecute,
  OnSubscribeEventPayload as OnSubscribe,
} from '@envelop/types';
import { Injectable } from '@nestjs/common';
import { GqlContextType as ContextType } from '~/common';
import { maskSecrets } from '~/common/mask-secrets';
import { ILogger, Logger } from '../logger';
import { Plugin } from './plugin.decorator';

/**
 * Logging for GraphQL errors that are not handled anywhere else
 * Note: Lots of assumptions here.
 */
@Plugin()
@Injectable()
export class GraphqlLoggingPlugin {
  constructor(@Logger('graphql') private readonly logger: ILogger) {}

  onExecute: Plugin['onExecute'] = ({ args }) => {
    this.logReq(args);
  };

  onSubscribe: Plugin['onSubscribe'] = ({ args }) => {
    this.logReq(args);
  };

  logReq(args: (OnExecute<ContextType> | OnSubscribe<ContextType>)['args']) {
    const { operationName, variableValues, contextValue } = args;
    if (operationName === 'IntrospectionQuery') {
      return;
    }
    this.logger.info(`Received ${contextValue.operation.operation}`, {
      operation: operationName,
      ...maskSecrets(variableValues ?? {}),
    });
  }
}
