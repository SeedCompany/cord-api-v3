import { HttpStatus } from '@nestjs/common';
import { ServerException } from './exception';

export class TransientException extends ServerException {}

export class ServiceUnavailableException extends TransientException {
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;
  constructor(message: string, previous?: Error) {
    super(message ?? 'Service Unavailable', previous);
  }
}
