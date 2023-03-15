export enum LogLevel {
  EMERGENCY = 'emerg',
  ALERT = 'alert',
  CRITICAL = 'crit',
  ERROR = 'error',
  WARNING = 'warning',
  NOTICE = 'notice',
  INFO = 'info',
  DEBUG = 'debug',
}

export const LoggerName = Symbol('LoggerName');

export const getNameFromEntry = (
  entry: Record<string, any>,
): string | undefined => {
  // @ts-expect-error TS can't index on symbols??
  // https://github.com/Microsoft/TypeScript/issues/24587
  return entry[LoggerName];
};

export type LogEntry = { level: LogLevel; message: string } & LogEntryContext;

export type LogEntryContext = Record<string, any>;

/**
 * Our Logger interface.
 * This should be the type referenced everywhere in app code.
 *
 * Please try to keep log messages static and put dynamic values in context.
 * This will help in grouping log messages and values differently for different
 * destinations (CLI vs CloudWatch)
 *
 * For example:
 *   Don't do this:
 *   logger.debug(`Doing the thing with ${object}`);
 *   Instead do this instead:
 *   logger.debug(`Doing the thing`, { object });
 *
 *
 * Note: this is just a class for dependency injection.
 * It should be treated like an interface.
 */
export abstract class ILogger {
  /**
   * System is unusable.
   */
  abstract emergency(message: string, context?: LogEntryContext): void;
  abstract emergency(entry: { message: string } & LogEntryContext): void;

  /**
   * Action must be taken immediately.
   *
   * Example: Entire website down, database unavailable, etc. This should
   * trigger the SMS alerts and wake you up.
   */
  abstract alert(message: string, context?: LogEntryContext): void;
  abstract alert(entry: { message: string } & LogEntryContext): void;

  /**
   * Critical conditions.
   *
   * Example: Application component unavailable, unexpected exception.
   */
  abstract critical(message: string, context?: LogEntryContext): void;
  abstract critical(entry: { message: string } & LogEntryContext): void;

  /**
   * Runtime errors that do not require immediate action but should typically
   * be logged and monitored.
   */
  abstract error(message: string, context?: LogEntryContext): void;
  abstract error(entry: { message: string } & LogEntryContext): void;

  /**
   * Exceptional occurrences that are not errors.
   *
   * Example: Use of deprecated APIs, poor use of an API, undesirable things
   * that are not necessarily wrong.
   */
  abstract warning(message: string, context?: LogEntryContext): void;
  abstract warning(entry: { message: string } & LogEntryContext): void;

  /**
   * Normal but significant events.
   */
  abstract notice(message: string, context?: LogEntryContext): void;
  abstract notice(entry: { message: string } & LogEntryContext): void;

  /**
   * Interesting events.
   *
   * Example: User logs in, SQL logs.
   */
  abstract info(message: string, context?: LogEntryContext): void;
  abstract info(entry: { message: string } & LogEntryContext): void;

  /**
   * Detailed debug information.
   */
  abstract debug(message: string, context?: LogEntryContext): void;
  abstract debug(entry: { message: string } & LogEntryContext): void;

  /**
   * Logs with an arbitrary level.
   */
  abstract log(
    level: LogLevel,
    message: string,
    context?: LogEntryContext,
  ): void;
  abstract log(
    level: LogLevel,
    entry: { message: string } & LogEntryContext,
  ): void;
  abstract log(entry: LogEntry): void;
}
