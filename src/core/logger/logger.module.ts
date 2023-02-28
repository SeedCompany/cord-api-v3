import {
  DynamicModule,
  Global,
  Module,
  Logger as NestLogger,
  Provider,
} from '@nestjs/common';
import { memoize } from 'lodash';
import { createLogger, format, transports } from 'winston';
import { ConfigService } from '../config/config.service';
import { BufferLoggerService } from './buffer-logger.service';
import { ExceptionHandler } from './exception-logger';
import {
  colorize,
  exceptionInfo,
  formatException,
  maskSecrets,
  metadata,
  pid,
  printForCli,
  printForJson,
  timestamp,
} from './formatters';
import { LevelMatcherProvider } from './level-matcher.provider';
import { loggerNames, LoggerToken } from './logger.decorator';
import { ILogger } from './logger.interface';
import { NamedLoggerService } from './named-logger.service';
import { NestLoggerAdapterService } from './nest-logger-adapter.service';
import { NullLoggerService } from './null-logger.service';
import { ProxyLoggerService } from './proxy-logger.service';
import { LoggerOptions, WinstonLoggerService } from './winston-logger.service';

const buffer = new BufferLoggerService();
const proxy = new ProxyLoggerService();
proxy.setLogger(buffer);
export const bootstrapLogger = new NestLoggerAdapterService(proxy);

// A nice error logger for when the actual logger cannot be created
ExceptionHandler.getLogger = memoize(() =>
  createLogger({
    transports: [new transports.Console()],
    format: format.combine(exceptionInfo(), formatException(), printForCli()),
  }),
);

@Global()
@Module({
  providers: [
    LevelMatcherProvider,
    NamedLoggerService,
    { provide: BufferLoggerService, useValue: buffer },
    { provide: ProxyLoggerService, useValue: proxy },
    WinstonLoggerService,
    {
      provide: ILogger,
      useExisting: ProxyLoggerService,
    },
    {
      provide: NestLogger,
      useClass: NestLoggerAdapterService,
    },
    {
      provide: LoggerOptions,
      useFactory: (config: ConfigService): LoggerOptions => {
        const formatting = format.combine(
          exceptionInfo(),
          metadata(),
          maskSecrets(),
          ...(config.jsonLogs
            ? [printForJson()]
            : [
                timestamp(),
                format.ms(),
                pid(),
                colorize(),
                formatException(),
                printForCli(),
              ]),
        );

        return {
          transports: [new transports.Console()],
          format: formatting,
        };
      },
      inject: [ConfigService],
    },
  ],
})
export class LoggerModule {
  static forTest(): DynamicModule {
    const module = LoggerModule.forRoot();
    module.providers?.push({
      provide: ILogger,
      useClass: NullLoggerService,
    });
    return module;
  }

  static forRoot(): DynamicModule {
    const namedLoggerProviders =
      Array.from(loggerNames).map(namedLoggerProvider);
    return {
      module: LoggerModule,
      providers: namedLoggerProviders,
      exports: namedLoggerProviders,
    };
  }

  constructor(
    proxy: ProxyLoggerService,
    winston: WinstonLoggerService,
    buffer: BufferLoggerService,
  ) {
    proxy.setLogger(winston);
    buffer.flushTo(winston);
    ExceptionHandler.getLogger = () => winston;
  }
}

const namedLoggerProvider = (name: string): Provider<ILogger> => ({
  provide: LoggerToken(name),
  useFactory: (logger: NamedLoggerService) => logger.setName(name),
  inject: [NamedLoggerService],
});
