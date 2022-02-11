import { Injectable, Optional } from '@nestjs/common';
import { parse as parseEnv } from 'dotenv';
import * as dotEnvExpand from 'dotenv-expand';
import * as fs from 'fs';
import { isString, mapKeys, pickBy } from 'lodash';
import { Duration, DurationLike } from 'luxon';
import { join } from 'path';
import { ILogger, Logger } from '../logger';

/**
 * Handle reading values from environment and env files.
 * This should only be used in the ConfigService.
 * Keys are case insensitive.
 */
@Injectable()
export class EnvironmentService implements Iterable<[string, string]> {
  private readonly env: Record<string, string>;

  constructor(
    @Logger('config:environment') private readonly logger: ILogger,
    @Optional() rootPath = process.cwd(),
    @Optional() env = process.env.NODE_ENV || 'development'
  ) {
    // I think we have to load parent env by default
    // as pairs could be passed in instead of in env files
    this.env = pickBy(process.env) as Record<string, string>;

    const files = [`.env.${env}.local`, `.env.${env}`, `.env.local`, `.env`]
      .filter(isString)
      .map((file) => join(rootPath, file));

    for (const file of files) {
      if (!fs.existsSync(file)) {
        this.logger.debug(`Skipping file`, { file });
        continue;
      }
      this.logger.debug(`Loading file`, { file });

      const parsed = parseEnv(fs.readFileSync(file));

      // dotenv-expand uses mutates process.env so replace
      // with that with our object while calling this function.
      const temp = process.env;
      process.env = this.env;
      try {
        dotEnvExpand({ parsed });
      } finally {
        process.env = temp;
      }

      this.env = pickBy(this.env);
    }

    // Convert all keys to uppercase
    this.env = mapKeys(this.env, (_, key) => key.toUpperCase());

    this.logger.debug(`Loaded environment`, this.env);
  }

  string(key: string) {
    return this.wrap(key, (raw) => raw);
  }

  boolean(key: string) {
    return this.wrap(key, (raw) => raw.toLowerCase() === 'true');
  }

  duration(key: string) {
    key = key.toUpperCase();
    return new DurationConfigValue(
      key in this.env,
      key,
      this.env[key],
      Duration.from
    );
  }

  number(key: string) {
    return this.wrap(key, (raw) => {
      const val = raw.toLowerCase();
      if (val === 'infinity') {
        return Infinity;
      }
      if (val === '-infinity') {
        return -Infinity;
      }
      const parsed = parseFloat(val);
      if (isNaN(parsed)) {
        throw new Error(
          `Environment "${key}" has value "${val}" which cannot be parsed to a number`
        );
      }

      return parsed;
    });
  }

  *[Symbol.iterator]() {
    yield* Object.entries<string>(this.env);
  }

  private wrap<T>(key: string, parse: (raw: string) => T) {
    key = key.toUpperCase();
    return new ConfigValue(key in this.env, key, this.env[key], parse);
  }
}

class ConfigValue<T> {
  constructor(
    readonly exists: boolean,
    readonly key: string,
    protected readonly rawValue: string,
    protected readonly parse: (raw: string) => T
  ) {}

  required() {
    if (!this.exists) {
      throw new Error(`Environment does not have "${this.key}"`);
    }
    return this.parse(this.rawValue);
  }

  optional<D = undefined>(defaultValue?: D): T | D {
    return this.exists ? this.parse(this.rawValue) : defaultValue!;
  }
}

class DurationConfigValue extends ConfigValue<Duration> {
  optional(): Duration | undefined;
  optional(defaultValue: string | DurationLike): Duration;
  optional(defaultValue?: string | DurationLike) {
    return this.exists
      ? this.parse(this.rawValue)
      : defaultValue == null
      ? undefined
      : Duration.from(defaultValue);
  }
}
