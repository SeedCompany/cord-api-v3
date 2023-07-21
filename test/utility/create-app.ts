import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { LogLevel } from '../../src/core/logger';
import { LevelMatcher } from '../../src/core/logger/level-matcher';
import {
  createGraphqlClient,
  GraphQLTestClient,
} from './create-graphql-client';

// Patch faker email to be more unique
const origEmail = faker.internet.email.bind(faker.internet);
faker.internet.email = (...args) =>
  origEmail(...(args as any)).replace('@', `.${Date.now()}@`);

export interface TestApp extends INestApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LevelMatcher)
    .useValue(new LevelMatcher([], LogLevel.ERROR))
    .compile();

  const app = moduleFixture.createNestApplication<TestApp>();
  await app.init();
  app.graphql = await createGraphqlClient(app);

  return app;
};
