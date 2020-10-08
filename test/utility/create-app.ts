import { INestApplication } from '@nestjs/common';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { Test } from '@nestjs/testing';
import * as faker from 'faker';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/core';
import { LogLevel } from '../../src/core/logger';
import { LevelMatcher } from '../../src/core/logger/level-matcher';
import {
  createGraphqlClient,
  getGraphQLOptions,
  GraphQLTestClient,
} from './create-graphql-client';

// Patch faker email to be more unique
const origEmail = faker.internet.email.bind(faker.internet);
faker.internet.email = (...args) =>
  origEmail(...args).replace('@', `.${Date.now()}@`);

export interface TestApp extends INestApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GRAPHQL_MODULE_OPTIONS)
    .useValue(getGraphQLOptions())
    .overrideProvider(LevelMatcher)
    .useValue(new LevelMatcher({}, LogLevel.ERROR))
    .compile();

  const app = moduleFixture.createNestApplication<TestApp>();
  await app.init();
  app.graphql = await createGraphqlClient(app);

  const rootAdmin = app.get(ConfigService).rootAdmin;
  process.env = Object.assign(process.env, {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ROOT_ADMIN_EMAIL: rootAdmin.email,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ROOT_ADMIN_PASSWORD: rootAdmin.password,
  });

  return app;
};
