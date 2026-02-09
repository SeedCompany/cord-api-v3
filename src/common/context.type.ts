import { type OperationDefinitionNode } from 'graphql';
import type { IRequest, IResponse } from '~/core/http';
import type { Webhook } from '~/core/webhooks/dto';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  operation: OperationDefinitionNode;
  request?: IRequest;
  response?: IResponse;
  /** This op is executing for this webhook */
  webhook?: Webhook;
}
