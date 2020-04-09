import { Provider } from '@nestjs/common';
import { promises as fs } from 'fs';
import { load } from 'js-yaml';
import { ConfigService } from '..';
import { pickBy } from 'lodash';
import { LevelMatcher } from './level-matcher';

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
    const overrides: Partial<typeof defaults> = rawYaml
      ? pickBy(load(rawYaml, { filename: path }))
      : {};

    // TODO Handle DEBUG key
    const config = {
      ...defaults,
      ...overrides,
    };
    return new LevelMatcher(config.levels, config.defaultLevel);
  },
};
