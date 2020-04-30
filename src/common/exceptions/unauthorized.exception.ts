import { HttpStatus } from '@nestjs/common';
import { InputException } from './input.exception';

/**
 * The requester has insufficient permission to do this operation.
 */
export class UnauthorizedException extends InputException {
  readonly status = HttpStatus.FORBIDDEN;

  constructor(message?: string, field?: string, previous?: Error) {
    super(message ?? `Insufficient permission`, field, previous);
  }
}
