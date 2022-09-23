import { Provider } from '@nestjs/common';
import { promises as fs } from 'fs';
import { identity, pickBy } from 'lodash';
import { parse } from 'yaml';
import { mapFromList } from '~/common';
import { ConfigService } from '../config/config.service';
import { LevelMatcher } from './level-matcher';
import { LogLevel } from './logger.interface';

export const LevelMatcherProvider: Provider<Promise<LevelMatcher>> = {
  provide: LevelMatcher,
  useFactory: async () => {
    let rawYaml = '';
    const path = 'logging.yml';
    try {
      rawYaml = await fs.readFile(path, { encoding: 'utf8' });
    } catch (e) {
      // Completely optional. Logging is iffy since this is for the logger
    }
    const defaults = ConfigService.logging;
    const yamlOverrides: Partial<typeof defaults> = rawYaml
      ? pickBy(parse(rawYaml) as typeof defaults)
      : {};

    const envDefault = process.env.LOG_LEVEL_DEFAULT as LogLevel | undefined;
    // env levels take the form of a,b=level;c,d=level
    const envLevels: Record<string, LogLevel> = mapFromList(
      (process.env.LOG_LEVELS || '').split(';').flatMap((pair) => {
        const matched = /\s*([\w\s,-:*]+)=\s*(\w+)\s*/.exec(pair);
        return matched ? [[matched[1], matched[2]]] : [];
      }),
      identity
    );

    const declaredLevels = {
      ...yamlOverrides.levels,
      ...envLevels,
    };
    const levels =
      Object.keys(declaredLevels).length === 0
        ? defaults.levels
        : declaredLevels;

    const defaultLevel =
      envDefault ?? yamlOverrides.defaultLevel ?? defaults.defaultLevel;
    return new LevelMatcher(levels, defaultLevel);
  },
};
