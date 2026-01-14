import { afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { DeepPartial } from 'ts-essentials';
import { andCall } from '~/common';
import { ConfigService } from '~/core';
import { HttpAdapter, type NestHttpApplication } from '~/core/http';
import { LogLevel } from '~/core/logger';
import { LevelMatcher } from '~/core/logger/level-matcher';
import { AppModule } from '../../src/app.module';
import { ephemeralGel } from './gel-setup';

export type TestApp = Pick<NestHttpApplication, 'get'>;

const appsToClose = new Set<NestHttpApplication>();
afterAll(async () => {
  for (const app of appsToClose) {
    await app.close();
  }
});

export const createApp = async ({
  config,
}: {
  config?: DeepPartial<ConfigService>;
} = {}): Promise<TestApp> => {
  const db = await ephemeralGel();

  let app;
  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LevelMatcher)
      .useValue(new LevelMatcher([], LogLevel.ERROR))
      .overrideProvider('GEL_CONNECT')
      .useValue(db?.options)
      .overrideProvider('CONFIG_PART')
      .useValue(config)
      .compile();

    app = moduleFixture.createNestApplication<NestHttpApplication>(
      new HttpAdapter(),
    );
  } catch (e) {
    await db?.cleanup();
    throw e;
  }

  andCall(app, 'close', async () => {
    await db?.cleanup();
  });

  try {
    const config = app.get(ConfigService);
    await app.configure(app, config);

    await app.listen(0);
    const url = await app.getUrl();
    config.hostUrl$.next(new URL(url) as URL & string);
  } catch (e) {
    await app.close();
    throw e;
  }

  appsToClose.add(app);

  return app;
};
