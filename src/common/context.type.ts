import { type OperationDefinitionNode } from 'graphql';
import type { IRequest, IResponse } from '~/core/http';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  operation: OperationDefinitionNode;
  request?: IRequest;
  response?: IResponse;
}
