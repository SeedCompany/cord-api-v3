import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import { andCall } from '~/common';
import { ConfigService } from '~/core';
import { HttpAdapter, NestHttpApplication } from '~/core/http';
import { LogLevel } from '~/core/logger';
import { LevelMatcher } from '~/core/logger/level-matcher';
import { AppModule } from '../../src/app.module';
import {
  createGraphqlClient,
  GraphQLTestClient,
} from './create-graphql-client';
import { ephemeralGel } from './gel-setup';

// Patch faker email to be more unique
const origEmail = faker.internet.email.bind(faker.internet);
faker.internet.email = (...args) =>
  origEmail(...(args as any)).replace('@', `.${Date.now()}@`);

export interface TestApp extends NestHttpApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  const db = await ephemeralGel();

  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LevelMatcher)
      .useValue(new LevelMatcher([], LogLevel.ERROR))
      .overrideProvider('GEL_CONNECT')
      .useValue(db?.options)
      .compile();

    const app = moduleFixture.createNestApplication<TestApp>(new HttpAdapter());
    await app.configure(app, app.get(ConfigService));
    await app.init();
    app.graphql = await createGraphqlClient(app);

    andCall(app, 'close', async () => {
      await db?.cleanup();
    });

    return app;
  } catch (e) {
    await db?.cleanup();
    throw e;
  }
};
