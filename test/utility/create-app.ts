import { INestApplication } from '@nestjs/common';
import { ApplicationConfig } from '@nestjs/core';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { Test } from '@nestjs/testing';
import { remove } from 'lodash';
import { AppModule } from '../../src/app.module';
import { LogLevel } from '../../src/core/logger';
import { LevelMatcher } from '../../src/core/logger/level-matcher';
import { ValidationPipe } from '../../src/core/validation.pipe';
import {
  createGraphqlClient,
  getGraphQLOptions,
  GraphQLTestClient,
} from './create-graphql-client';

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

  // Remove ValidationPipe for tests because of failures
  // @ts-expect-error ignore the fact that it's private
  const appConfig: ApplicationConfig = moduleFixture.applicationConfig;
  remove(appConfig.getGlobalPipes(), (p) => p instanceof ValidationPipe);

  const app = moduleFixture.createNestApplication<TestApp>();
  await app.init();
  app.graphql = await createGraphqlClient(app);

  return app;
};
