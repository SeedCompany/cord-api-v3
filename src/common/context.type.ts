import { Request, Response } from 'express';
import { RawSession } from './session';

/**
 * The type for graphql @Context() decorator
 */
export interface GqlContextType {
  request: Request;
  response: Response;
  session?: RawSession;
}
