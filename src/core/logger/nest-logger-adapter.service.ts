import {
  LoggerService as INestLogger,
  Injectable,
  Logger as NestLogger,
  OnModuleInit,
} from '@nestjs/common';
import { ILogger, LoggerName } from './logger.interface';

/**
 * Adapts/wraps our Logger into a Nest Logger interface.
 * This replaces the default Nest Logger after app is bootstrapped.
 */
@Injectable()
export class NestLoggerAdapterService implements INestLogger, OnModuleInit {
  private static readonly nameMap: Record<string, string> = {
    NestFactory: 'nest:factory',
    InstanceLoader: 'nest:loader',
    ExceptionsHandler: 'nest:exception',
    NestApplication: 'nest:application',
    RouterExplorer: 'nest:router:explorer',
    RoutesResolver: 'nest:router:resolver',
    GraphQLModule: 'graphql:module',
  };

  constructor(private readonly logger: ILogger) {}

  onModuleInit() {
    NestLogger.overrideLogger(this);
  }

  debug(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.debug(message, name);
  }

  error(message: any, trace?: string, context?: string) {
    const name = this.mapName(context);
    this.logger.error(message, {
      ...name,
      ...(trace ? { stack: trace, exception: true } : {}),
    });
  }

  log(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.info(message, name);
  }

  verbose(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.debug(message, name);
  }

  warn(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.warning(message, name);
  }

  private mapName(context?: string) {
    const name = context
      ? NestLoggerAdapterService.nameMap[context] || context
      : 'nest';
    return { [LoggerName]: name };
  }
}
