import { Injectable } from '@nestjs/common';
import { AbstractLogger } from './abstract-logger';
import { type ILogger, type LogEntry } from './logger.interface';

/**
 * Implementation of our Logger that forwards to another logger.
 */
@Injectable()
export class ProxyLoggerService extends AbstractLogger {
  private logger?: ILogger;

  logEntry(entry: LogEntry): void {
    if (this.logger) {
      this.logger.log(entry);
    }
  }

  setLogger(logger: ILogger) {
    const prev = this.logger;
    this.logger = logger;
    return prev;
  }
}
