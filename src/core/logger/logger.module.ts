import {
  DynamicModule,
  Global,
  Logger as NestLogger,
  Module,
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
import { LoggerOptions, WinstonLoggerService } from './winston-logger.service';
import { NestLoggerAdapterService } from './nest-logger-adapter.service';
import { getLoggerToken } from './logger.utils';
import { NamedLoggerService } from './named-logger.service';

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
  static prefixesForLoggers: string[] = new Array<string>();

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
        printForCli(),
      ),
    };

    const namedLoggerProviders = this.prefixesForLoggers.map(
      namedLoggerProvider,
    );
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

const namedLoggerProvider = (prefix: string): Provider<ILogger> => ({
  provide: getLoggerToken(prefix),
  useFactory: (logger: NamedLoggerService) => logger.setName(prefix),
  inject: [NamedLoggerService],
});
