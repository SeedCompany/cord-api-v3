import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Format } from 'logform';
import { config, createLogger, Logger as WinstonLogger } from 'winston';
import * as Transport from 'winston-transport';
import { AbstractLogger } from './abstract-logger';
import { LevelMatcher } from './level-matcher';
import { getNameFromEntry, LogEntry, LogLevel } from './logger.interface';

export class LoggerOptions {
  format: Format;
  transports: Transport[];
}

/**
 * Winston implementation of our Logger with a custom level matcher.
 */
@Injectable()
export class WinstonLoggerService
  extends AbstractLogger
  implements OnModuleDestroy
{
  private readonly logger: WinstonLogger;
  private closing = false;

  constructor(private readonly matcher: LevelMatcher, options: LoggerOptions) {
    super();
    this.logger = createLogger({
      format: options.format,
      transports: options.transports,
      // Map our LogLevels, which match syslog, to priority levels
      levels: config.syslog.levels,
      // Enable all levels, since we filter levels ourselves
      level: LogLevel.DEBUG,
    });
  }

  logEntry({ level, message, ...context }: LogEntry): void {
    if (this.closing) {
      return;
    }

    const name = getNameFromEntry(context) ?? 'unknown';

    // Skip logging exceptions as Jest will display them properly.
    if (name === 'nest:exception' && (global as any).jasmine) {
      return;
    }

    if (!this.matcher.isEnabled(name, level)) {
      return;
    }
    this.logger.log(level, message, context);
  }

  async onModuleDestroy() {
    const finish = Promise.all(
      this.logger.transports.map(
        (t) => new Promise((resolve) => t.on('finish', resolve)),
      ),
    );
    this.closing = true;
    this.logger.end();
    await finish;
  }
}
