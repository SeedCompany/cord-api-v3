import {
  Injectable,
  Logger as NestLogger,
  LoggerService as INestLogger,
  OnModuleInit,
} from '@nestjs/common';
import { ILogger } from './logger.interface';

/**
 * Adapts/wraps our Logger into a Nest Logger interface.
 * This replaces the default Nest Logger after app is bootstrapped.
 */
@Injectable()
export class NestLoggerAdapterService implements INestLogger, OnModuleInit {
  private static nameMap = {
    NestFactory: 'nest:factory',
    InstanceLoader: 'nest:loader',
    ExceptionsHandler: 'nest:exception',
    NestApplication: 'nest:application',
  };

  constructor(private logger: ILogger) {}

  onModuleInit() {
    NestLogger.overrideLogger(this);
  }

  debug(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.debug(message, { name });
  }

  error(message: any, trace?: string, context?: string) {
    const name = this.mapName(context);
    this.logger.error(message, {
      name,
      ...(trace ? { stack: trace, exception: true } : {}),
    });
  }

  log(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.info(message, { name });
  }

  verbose(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.debug(message, { name });
  }

  warn(message: any, context?: string) {
    const name = this.mapName(context);
    this.logger.warning(message, { name });
  }

  private mapName(context?: string) {
    // @ts-ignore FIXME: unclear how to get around the TS error here
    return context ? NestLoggerAdapterService.nameMap[context] || context : 'nest';
  }
}
