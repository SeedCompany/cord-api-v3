import { Injectable, Scope } from '@nestjs/common';
import { AbstractLogger } from './abstract-logger';
import { ILogger, type LogEntry, LoggerName } from './logger.interface';

/**
 * This is the logger that will be injected everywhere in app code.
 * Each injection gets its own instance with the name provided.
 * All it does is forward logs to the ILogger with the name
 * as part of the entry.
 */
@Injectable({
  scope: Scope.TRANSIENT,
})
export class NamedLoggerService extends AbstractLogger {
  private name?: string;

  constructor(private readonly realLogger: ILogger) {
    super();
  }

  /** Set the name of this logger */
  setName(name: string) {
    this.name = name;
    return this;
  }

  logEntry(entry: LogEntry): void {
    this.realLogger.log({
      ...(this.name ? { [LoggerName]: this.name } : {}),
      ...entry,
    });
  }
}
