import { config } from 'winston';
import { LogLevel } from './logger.interface';

interface MatcherConfig {
  include: RegExp[];
  exclude: RegExp[];
  level: LogLevel;
}

/**
 * Determines whether a named logger is enabled for the given log level.
 *
 * It works similarly to the `debug` library, where loggers are named/namespace
 * and you specify which loggers you want with a single DEBUG env var.
 * Their logger doesn't have any levels, where ours does.
 *
 * In order to map the loggers to a level you provide an object mapping the
 * name(s) to a level. Each key can specify one or more names separated by comma.
 * An `*` can be used as a wild card as well matching sub namespaces.
 * It's important to note the order of the keys matters as the first matching
 * name determines the level.
 *
 * An simple example:
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
 * logging.yml file in the project root. See the example file as a starting point.
 */
export class LevelMatcher {
  private readonly matchers: MatcherConfig[] = [];
  private cached: Record<string, LogLevel> = {};

  constructor(
    levelMap: Record<string, LogLevel>,
    private readonly defaultLevel: LogLevel
  ) {
    for (const [namespaces, level] of Object.entries(levelMap)) {
      const matcher: MatcherConfig = {
        include: [],
        exclude: [],
        level,
      };
      for (const namespace of namespaces.split(/[\s,]+/)) {
        const exclude = namespace.startsWith('-');
        const regPart = namespace.replace(/\*/g, '.*?');
        if (exclude) {
          matcher.exclude.push(new RegExp(`^${regPart.substr(1)}$`));
        } else {
          matcher.include.push(new RegExp(`^${regPart}$`));
        }
      }
      this.matchers.push(matcher);
    }
  }

  isEnabled(name: string, level: LogLevel): boolean {
    const configuredLevel = this.getLevel(name);
    return config.syslog.levels[level] <= config.syslog.levels[configuredLevel];
  }

  getLevel(name: string): LogLevel {
    if (this.cached[name]) {
      return this.cached[name];
    }
    for (const { include, exclude, level } of this.matchers) {
      const matched =
        include.some((regex) => regex.exec(name)) &&
        !exclude.some((regex) => regex.exec(name));
      if (matched) {
        this.cached[name] = level;
        return level;
      }
    }
    this.cached[name] = this.defaultLevel;
    return this.defaultLevel;
  }
}
