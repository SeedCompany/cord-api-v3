import { Inject } from '@nestjs/common';

/**
 * Injects a `ILogger`
 *
 * @param name Should be lower-cased and namespaced with colons
 *             Ex: `foo:bar:service`
 */
export const Logger = (name: string) => Inject(LoggerToken(name));

/**
 * Internal to logging setup, don't reference directly.
 */
export const loggerNames = new Set<string>();

/**
 * Creates the token for a named logger
 * @param name The name of the logger
 */
export const LoggerToken = (name: string) => {
  loggerNames.add(name);
  return `Logger(${name})`;
};
