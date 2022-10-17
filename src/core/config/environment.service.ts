import { Injectable, Optional } from '@nestjs/common';
import { parse as parseEnv } from 'dotenv';
import dotEnvExpand from 'dotenv-expand';
import * as fs from 'fs';
import { parse as parseSize } from 'human-format';
import { isString, mapKeys, pickBy } from 'lodash';
import { Duration } from 'luxon';
import { join } from 'path';
import { DurationIn } from '~/common';
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
    return this.wrap(key, (raw: string) => raw);
  }

  boolean(key: string) {
    return this.wrap(key, (raw: string | boolean) =>
      typeof raw === 'boolean' ? raw : raw.toLowerCase() === 'true'
    );
  }

  duration(key: string) {
    return this.wrap<Duration, DurationIn>(key, Duration.from);
  }

  number(key: string, options?: Parameters<typeof parseSize>[1]) {
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
        return parseSize(raw, options);
      } catch (e) {
        throw new Error(
          `Environment "${key}" has value "${raw}" which cannot be parsed to a number`
        );
      }
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
    protected readonly parse: (raw: In | string) => Out
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
