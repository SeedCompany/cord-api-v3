import { afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
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

export const createApp = async (): Promise<TestApp> => {
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
      .compile();

    app = moduleFixture.createNestApplication<NestHttpApplication>(
      new HttpAdapter(),
    );
    const config = app.get(ConfigService);
    await app.configure(app, config);
    await app.init();

    await app.listen(0);
    const url = await app.getUrl();
    config.hostUrl$.next(new URL(url) as URL & string);
  } catch (e) {
    await db?.cleanup();
    throw e;
  }

  andCall(app, 'close', async () => {
    await db?.cleanup();
  });

  appsToClose.add(app);

  return app;
};
