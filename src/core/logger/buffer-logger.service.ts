import { Injectable } from '@nestjs/common';
import { AbstractLogger } from './abstract-logger';
import type { ILogger, LogEntry } from './logger.interface';

/**
 * Implementation of our Logger that stores log messages in array.
 */
@Injectable()
export class BufferLoggerService extends AbstractLogger {
  private entries: LogEntry[] = [];

  logEntry(entry: LogEntry): void {
    this.entries.push(entry);
  }

  flushTo(logger: ILogger): void {
    const entries = this.entries.slice(0);
    this.entries = [];
    for (const entry of entries) {
      logger.log(entry);
    }
  }
}
