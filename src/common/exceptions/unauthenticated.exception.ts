import { HttpStatus } from '@nestjs/common';
import { ClientException } from './exception';

/**
 * We cannot identify the requester.
 */
export class UnauthenticatedException extends ClientException {
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor(message?: string, previous?: Error) {
    super(message ?? `Not authenticated`, previous);
  }
}
