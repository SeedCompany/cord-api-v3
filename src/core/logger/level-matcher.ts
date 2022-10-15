import { config } from 'winston';
import { CachedForArg } from '~/common';
import { LogLevel } from './logger.interface';

interface MatcherConfig {
  include: RegExp[];
  exclude: RegExp[];
  level: LogLevel;
}

/**
 * Determines whether a named logger is enabled for the given log level.
 *
 * It works similarly to the `debug` library, where loggers are named/namespace,
 * and you specify which loggers you want with a single DEBUG env var.
 * Their logger doesn't have any levels, where ours does.
 *
 * In order to map the loggers to a level, you provide an object mapping the
 * name(s) to a level.
 * Each key can specify one or more names separated by comma.
 * An `*` can be used as a wild card as well that will match sub namespaces.
 * It's important to note the order of the keys matters as the first matching
 * name determines the level.
 *
 * A simple example:
 *     {
 *       'foo:bar': LogLevel.DEBUG,
 *       'foo:*': LogLevel.INFO,
 *       'foo': LogLevel.ERROR,
 *     }
 * `foo:bar` would have a level of DEBUG
 * `foo:green` would have a level of INFO
 * `foo` would have a level of ERROR
 * `red` is not matched in any of these entries so the default level will be used.
 *
 * An example with multiple names:
 *     {
 *       'foo:bar, user:service': LogLevel.DEBUG,
 *       'foo:*, user:service': LogLevel.INFO,
 *       'foo': LogLevel.ERROR,
 *     }
 * `user:service` would have a level of DEBUG
 * since it is matched before the INFO entry.
 *
 * Names can also be prefixed with an `-` to exclude them.
 * This is also from the `debug` library.
 *     {
 *       'foo:*, -foo:utils': LogLevel.INFO,
 *     }
 * `foo:bar` would have a level of INFO
 * `foo:utils` would be skipped from matching that entry,
 * so the default would be used.
 *
 * You can personalize the level config for your local machine by using the
 * logging.yml file in the project root.
 * See the example file as a starting point.
 */
export class LevelMatcher {
  private readonly defaultLevel: LogLevel;
  private readonly matchers: MatcherConfig[] = [];

  constructor(
    levelMap: Record<string, string | undefined>,
    defaultLevel: LogLevel | string
  ) {
    this.defaultLevel = parseLevel(defaultLevel) ?? LogLevel.INFO;
    this.matchers = Object.entries(levelMap).flatMap(
      ([namespaces, rawLevel]) => {
        const level = parseLevel(rawLevel);
        if (!level || !namespaces) {
          return [];
        }

        const matcher: MatcherConfig = {
          include: [],
          exclude: [],
          level,
        };
        for (const namespace of namespaces.split(/[\s,]+/)) {
          const exclude = namespace.startsWith('-');
          const regPart = namespace.replace(/\*/g, '.*?');
          if (exclude) {
            matcher.exclude.push(new RegExp(`^${regPart.slice(1)}$`));
          } else {
            matcher.include.push(new RegExp(`^${regPart}$`));
          }
        }

        return [matcher];
      }
    );
  }

  isEnabled(name: string, level: LogLevel): boolean {
    const configuredLevel = this.getLevel(name);
    return config.syslog.levels[level] <= config.syslog.levels[configuredLevel];
  }

  @CachedForArg()
  getLevel(name: string): LogLevel {
    for (const { include, exclude, level } of this.matchers) {
      const matched =
        include.some((regex) => regex.exec(name)) &&
        !exclude.some((regex) => regex.exec(name));
      if (matched) {
        return level;
      }
    }
    return this.defaultLevel;
  }
}

const parseLevel = (level?: string): LogLevel | undefined => {
  if (!level?.trim()) {
    return undefined;
  }
  level = level.trim().toLowerCase();

  const levels = Object.values(LogLevel) as string[];
  if (levels.includes(level)) {
    return level as LogLevel;
  }

  for (const knownLevel of levels) {
    if (knownLevel.includes(level) || level.includes(knownLevel)) {
      return knownLevel as LogLevel;
    }
  }

  return undefined;
};
