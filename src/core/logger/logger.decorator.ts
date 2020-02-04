import { Inject } from '@nestjs/common';
import { LoggerToken } from './logger.module';

/**
 * Injects a `ILogger`
 *
 * @param name Should be lower-cased and namespaced with colons
 *             Ex: `foo:bar:service`
 */
export const Logger = (name: string) => Inject(LoggerToken(name));
