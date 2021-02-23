import { Request, Response } from 'express';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  request: Request;
  response?: Response;
}
