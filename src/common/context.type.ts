import { Request, Response } from 'express';
import { OperationDefinitionNode } from 'graphql';
import { BehaviorSubject } from 'rxjs';
import { Session } from './session';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  operation: OperationDefinitionNode;
  request?: Request;
  response?: Response;
  readonly session$: BehaviorSubject<Session | undefined>;
}
