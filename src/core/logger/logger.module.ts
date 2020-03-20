import {
  DynamicModule,
  Global,
  Module,
  Logger as NestLogger,
  Provider,
} from '@nestjs/common';
import { format, transports } from 'winston';
import {
  colorize,
  exceptionInfo,
  formatException,
  maskSecrets,
  metadata,
  pid,
  printForCli,
  timestamp,
} from './formatters';
import { LevelMatcherProvider } from './level-matcher.provider';
import { ILogger } from './logger.interface';
import { NamedLoggerService } from './named-logger.service';
import { NestLoggerAdapterService } from './nest-logger-adapter.service';
import { NullLoggerService } from './null-logger.service';
import { LoggerOptions, WinstonLoggerService } from './winston-logger.service';

@Global()
@Module({
  providers: [
    LevelMatcherProvider,
    {
      provide: ILogger,
      useClass: WinstonLoggerService,
    },
    {
      provide: NestLogger,
      useClass: NestLoggerAdapterService,
    },
    NamedLoggerService,
  ],
})
export class LoggerModule {
  static loggerNames: string[] = new Array<string>();

  static forTest(): DynamicModule {
    const module = LoggerModule.forRoot();
    module.providers?.push({
      provide: ILogger,
      useClass: NullLoggerService,
    });
    return module;
  }

  static forRoot(): DynamicModule {
    // Just CLI for now. We'll handle hooking up to cloudwatch later.
    const options: LoggerOptions = {
      transports: [new transports.Console()],
      format: format.combine(
        exceptionInfo(),
        metadata(),
        maskSecrets(),
        timestamp(),
        format.ms(),
        pid(),
        colorize(),
        formatException(),
        printForCli()
      ),
    };

    const namedLoggerProviders = this.loggerNames.map(namedLoggerProvider);
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LoggerOptions,
          useValue: options,
        },
        ...namedLoggerProviders,
      ],
      exports: namedLoggerProviders,
    };
  }
}

/**
 * Creates the token for a named logger
 * @param name The name of the logger
 */
export const LoggerToken = (name: string) => {
  if (!LoggerModule.loggerNames.includes(name)) {
    LoggerModule.loggerNames.push(name);
  }
  return `Logger(${name})`;
};

const namedLoggerProvider = (name: string): Provider<ILogger> => ({
  provide: LoggerToken(name),
  useFactory: (logger: NamedLoggerService) => logger.setName(name),
  inject: [NamedLoggerService],
});
