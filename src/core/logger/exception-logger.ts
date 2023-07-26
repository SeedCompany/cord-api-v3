import { ExceptionHandler as NestExceptionHandler } from '@nestjs/core/errors/exception-handler.js';
import { ExceptionsZone } from '@nestjs/core/errors/exceptions-zone.js';
import { ILogger } from './logger.interface';

/**
 * Replace the Nest exception handler with the ability to swap the logger
 */
class ExceptionLoggerClass implements NestExceptionHandler {
  getLogger?: () => Pick<ILogger, 'error'>;

  handle(exception: Error): void {
    try {
      if (this.getLogger) {
        this.getLogger().error(exception.message, { exception });
      } else {
        // eslint-disable-next-line no-console
        console.error(exception);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(exception);
    }
  }
}

export const ExceptionHandler = new ExceptionLoggerClass();

// @ts-expect-error I know it's private. hack hack.
ExceptionsZone.exceptionHandler = ExceptionHandler;
