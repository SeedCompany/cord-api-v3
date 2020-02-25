import { LogEntry, LogEntryContext, ILogger, LogLevel } from './logger.interface';

type MsgOrContext = string | ({ message: string } & LogEntryContext);

type LogArgs = [MsgOrContext, LogEntryContext?];

/**
 * Merges all the method options into a single logEntry method to implement.
 */
export abstract class AbstractLogger implements ILogger {
  abstract logEntry(entry: LogEntry): void;

  emergency(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.EMERGENCY, ...args));
  }

  alert(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.ALERT, ...args));
  }

  critical(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.CRITICAL, ...args));
  }

  error(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.ERROR, ...args));
  }

  warning(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.WARNING, ...args));
  }

  notice(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.NOTICE, ...args));
  }

  info(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.INFO, ...args));
  }

  debug(...args: LogArgs): void {
    this.logEntry(this.createEntry(LogLevel.DEBUG, ...args));
  }

  log(
    levelOrEntry:
      | LogLevel
      | ({ level: LogLevel; message: string } & LogEntryContext),
    msgOrContext?: string | ({ message: string } & LogEntryContext),
    context?: LogEntryContext,
  ): void {
    this.logEntry({
      ...(context || {}),
      ...(typeof msgOrContext === 'string'
        ? { message: msgOrContext }
        : msgOrContext),
      ...(typeof levelOrEntry === 'string'
        ? { level: levelOrEntry, message: '' }
        : levelOrEntry),
    });
  }

  private createEntry(
    level: LogLevel,
    msgOrContext: MsgOrContext,
    context?: LogEntryContext,
  ): LogEntry {
    return {
      ...(context || {}),
      ...(typeof msgOrContext === 'string'
        ? { message: msgOrContext }
        : msgOrContext),
      level,
    };
  }
}
