import { Request, Response } from 'express';
import { OperationDefinitionNode } from 'graphql';
import { Session } from './session';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  operation: OperationDefinitionNode;
  request?: Request;
  response?: Response;
  session?: Session;
}
