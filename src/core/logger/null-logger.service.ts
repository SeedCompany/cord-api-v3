import { Injectable } from '@nestjs/common';
import { AbstractLogger } from './abstract-logger';

/**
 * Implementation of our Logger that does nothing.
 */
@Injectable()
export class NullLoggerService extends AbstractLogger {
  logEntry(): void {
    // noop
  }
}
