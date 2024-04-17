import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { andCall } from '~/common';
import { AppModule } from '../../src/app.module';
import { LogLevel } from '../../src/core/logger';
import { LevelMatcher } from '../../src/core/logger/level-matcher';
import {
  createGraphqlClient,
  GraphQLTestClient,
} from './create-graphql-client';
import { ephemeralEdgeDB } from './edgedb-setup';

// Patch faker email to be more unique
const origEmail = faker.internet.email.bind(faker.internet);
faker.internet.email = (...args) =>
  origEmail(...(args as any)).replace('@', `.${Date.now()}@`);

export interface TestApp extends INestApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  const db = await ephemeralEdgeDB();

  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LevelMatcher)
      .useValue(new LevelMatcher([], LogLevel.ERROR))
      .overrideProvider('EDGEDB_CONNECT')
      .useValue(db?.options)
      .compile();

    const app = moduleFixture.createNestApplication<TestApp>();
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
