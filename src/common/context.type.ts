import { Request } from 'express';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  request: Request;
}
