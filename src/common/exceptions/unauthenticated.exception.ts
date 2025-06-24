import { HttpStatus } from '@nestjs/common';
import { ClientException } from './exception';

/**
 * Any authentication-related problem
 */
export abstract class AuthenticationException extends ClientException {
  readonly status = HttpStatus.UNAUTHORIZED;
}

/**
 * We cannot identify the requester.
 */
export class UnauthenticatedException extends AuthenticationException {
  constructor(message?: string, previous?: Error) {
    super(message ?? `Not authenticated`, previous);
  }
}
