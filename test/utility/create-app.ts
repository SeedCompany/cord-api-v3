import { afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { andCall } from '~/common';
import { ConfigService } from '~/core';
import { HttpAdapter, type NestHttpApplication } from '~/core/http';
import { LogLevel } from '~/core/logger';
import { LevelMatcher } from '~/core/logger/level-matcher';
import { AppModule } from '../../src/app.module';
import { ephemeralGel } from '../setup/gel-setup';
import {
  createGraphqlClient,
  type GraphQLTestClient,
} from './create-graphql-client';

export interface TestApp extends NestHttpApplication {
  graphql: GraphQLTestClient;
}

const appsToClose = new Set<TestApp>();
afterAll(async () => {
  for (const app of appsToClose) {
    await app.close();
  }
});

export const createTestApp = async () => {
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

    app = moduleFixture.createNestApplication<TestApp>(new HttpAdapter());
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

  return Object.assign(Object.create(app) as TestApp, {
    graphql: createGraphqlClient(app),
  });
};
