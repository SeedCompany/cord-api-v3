import { Inject } from '@nestjs/common';
import { getLoggerToken } from './logger.utils';
import { LoggerModule } from './logger.module';

/**
 * Injects a `ILogger`
 *
 * @param name Should be lower-cased and namespaced with colons
 *             Ex: `foo:bar:service`
 */
export function Logger(name: string) {
  if (!LoggerModule.prefixesForLoggers.includes(name)) {
    LoggerModule.prefixesForLoggers.push(name);
  }
  return Inject(getLoggerToken(name));
}
