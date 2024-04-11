import { Injectable, Optional } from '@nestjs/common';
import { mapKeys } from '@seedcompany/common';
import { parse as parseEnv } from 'dotenv';
import { expand as dotEnvExpand } from 'dotenv-expand';
import * as fs from 'fs';
import humanFormat from 'human-format';
import { identity, pickBy } from 'lodash';
import { Duration } from 'luxon';
import { URL } from 'node:url';
import { join } from 'path';
import { DurationIn } from '~/common';
import { Logger } from '../logger/logger.decorator';
import type { ILogger } from '../logger/logger.interface';

/**
 * Handle reading values from environment and env files.
 * This should only be used in the ConfigService.
 * Keys are case insensitive.
 */
@Injectable()
export class EnvironmentService implements Iterable<[string, string]> {
  private readonly env: Record<string, string>;

  constructor(
    @Logger('config:environment')
    private readonly logger: ILogger | undefined = undefined,
    @Optional() rootPath = process.cwd(),
    @Optional() env = process.env.NODE_ENV || 'development',
  ) {
    // I think we have to load parent env by default
    // as pairs could be passed in instead of in env files
    this.env = pickBy(process.env) as Record<string, string>;

    const files = [
      `.env.${env}.local`,
      `.env.${env}`,
      `.env.local`,
      `.env`,
    ].map((file) => join(rootPath, file));

    for (const file of files) {
      if (!fs.existsSync(file)) {
        this.logger?.debug(`Skipping file`, { file });
        continue;
      }
      this.logger?.debug(`Loading file`, { file });

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
    this.env = mapKeys(this.env, (key) => key.toUpperCase()).asRecord;

    this.logger?.debug(`Loaded environment`, this.env);
  }

  string(key: string) {
    return this.wrap(key, (raw: string) => raw);
  }

  url(key: string): ConfigValue<
    Readonly<URL> &
      // Work around the linter not liking implicit toString concat
      string,
    URL | string
  > {
    return this.wrap(key, (raw) => Object.freeze(new URL(String(raw))) as any);
  }

  boolean(key: string) {
    return this.wrap(key, (raw: string | boolean) =>
      typeof raw === 'boolean' ? raw : raw.toLowerCase() === 'true',
    );
  }

  duration(key: string) {
    return this.wrap<Duration, DurationIn>(key, Duration.from);
  }

  number(key: string, options?: Parameters<(typeof humanFormat)['parse']>[1]) {
    return this.wrap<number, string | number>(key, (raw) => {
      if (typeof raw === 'number') {
        return raw;
      }
      const lower = raw.toLowerCase();
      if (lower === 'infinity') {
        return Infinity;
      }
      if (lower === '-infinity') {
        return -Infinity;
      }
      try {
        return humanFormat.parse(raw, options);
      } catch (e) {
        throw new Error(
          `Environment "${key}" has value "${raw}" which cannot be parsed to a number`,
        );
      }
    });
  }

  map<K extends string, V>(
    key: string,
    options: {
      parseKey?: ((raw: string) => K) | Iterable<K>;
      parseValue?: (raw: string) => V;
      pairSeparator?: string;
      keySeparator?: string;
    },
  ) {
    return this.wrap<
      ReadonlyMap<K, V>,
      string | ReadonlyMap<K, V> | Partial<Record<K, V>>
    >(key, (raw) => {
      if (raw instanceof Map) {
        return raw;
      }
      if (typeof raw === 'object') {
        return new Map(Object.entries(raw));
      }
      const { pairSeparator = ';', keySeparator = '=' } = options;

      const parseKey =
        typeof options.parseKey === 'function'
          ? options.parseKey
          : options.parseKey
          ? verifyInSet(key, options.parseKey)
          : identity;
      const parseValue = options.parseValue ?? identity;

      return new Map(
        (raw ?? '').split(pairSeparator).map((item) => {
          const [key, value] = item.trim().split(keySeparator);
          return [parseKey(key), parseValue(value)] as const;
        }),
      );
    });
  }

  *[Symbol.iterator]() {
    yield* Object.entries<string>(this.env);
  }

  private wrap<Out, In>(key: string, parse: (raw: In | string) => Out) {
    key = key.toUpperCase();
    return new ConfigValue(key in this.env, key, this.env[key], parse);
  }
}

class ConfigValue<Out, In> {
  constructor(
    readonly exists: boolean,
    readonly key: string,
    protected readonly rawValue: string,
    protected readonly parse: (raw: In | string) => Out,
  ) {}

  required() {
    if (!this.exists) {
      throw new Error(`Environment does not have "${this.key}"`);
    }
    return this.parse(this.rawValue);
  }

  optional(): Out | undefined;
  optional(defaultValue: In): Out;
  optional(defaultValue?: In): Out | undefined {
    return this.exists
      ? this.parse(this.rawValue)
      : defaultValue == null
      ? undefined
      : this.parse(defaultValue);
  }
}

const verifyInSet = <T extends string>(envKey: string, set: Iterable<T>) => {
  const validKeys = new Map([...set].map((key) => [key.toLowerCase(), key]));
  return (key: string): T => {
    if (validKeys.has(key.toLowerCase())) {
      return validKeys.get(key)!;
    }
    throw new Error(`Invalid map key given for ${envKey}: ${key}`);
  };
};
