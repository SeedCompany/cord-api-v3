import {
  ILogger,
  LogEntry,
  LogEntryContext,
  LogLevel,
} from './logger.interface';

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
    // This is logically correct, but TS doesn't think so.
    // So without the unsafe typecast there's an error.
    // Don't copy this. I just want to get this PR in.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.logEntry({
      ...(context || {}),
      ...(typeof msgOrContext === 'string'
        ? { message: msgOrContext }
        : msgOrContext),
      ...(typeof levelOrEntry === 'string'
        ? { level: levelOrEntry }
        : levelOrEntry),
    } as LogEntry);
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
