import type { LoggerService as INestLogger } from '@nestjs/common';
import type { ILogger } from './logger.interface';

/**
 * Adapts/wraps our Logger into a Nest Logger interface.
 */
export class NestLoggerAdapter implements INestLogger {
  constructor(private readonly logger: ILogger) {}

  debug(message: any) {
    this.logger.debug(message);
  }

  error(message: any, trace?: string) {
    this.logger.error(message, {
      ...(trace ? { stack: trace, exception: true } : {}),
    });
  }

  log(message: any) {
    this.logger.info(message);
  }

  verbose(message: any) {
    this.logger.debug(message);
  }

  warn(message: any) {
    this.logger.warning(message);
  }
}
