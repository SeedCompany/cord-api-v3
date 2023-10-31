import { Provider } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
import { promises as fs } from 'fs';
import { pickBy } from 'lodash';
import { parse } from 'yaml';
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
    const envLevels = mapEntries(
      (process.env.LOG_LEVELS || '').split(';'),
      (pair, { SKIP }) => {
        const matched = /\s*([\w\s,\-:*]+)=\s*(\w+)\s*/.exec(pair);
        return matched ? [matched[1], matched[2] as LogLevel] : SKIP;
      },
    ).asRecord;

    const levels = [envLevels, yamlOverrides.levels ?? {}, defaults.levels];

    const defaultLevel =
      envDefault ?? yamlOverrides.defaultLevel ?? defaults.defaultLevel;
    return new LevelMatcher(levels, defaultLevel);
  },
};
