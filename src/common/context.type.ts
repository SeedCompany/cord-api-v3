import { type OperationDefinitionNode } from 'graphql';
import { type BehaviorSubject } from 'rxjs';
import type { IRequest, IResponse } from '~/core/http';
import { type Session } from './session';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  operation: OperationDefinitionNode;
  request?: IRequest;
  response?: IResponse;
  readonly session$: BehaviorSubject<Session | undefined>;
}
