import { INestApplication, Logger } from '@nestjs/common';
import { GRAPHQL_MODULE_OPTIONS } from '@nestjs/graphql/dist/graphql.constants';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  createGraphqlClient,
  getGraphQLOptions,
  GraphQLTestClient,
} from './create-graphql-client';

export interface TestApp extends INestApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  Logger.overrideLogger(['error', 'warn']);

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GRAPHQL_MODULE_OPTIONS)
    .useValue(getGraphQLOptions())
    .compile();

  const app: TestApp = moduleFixture.createNestApplication();
  await app.init();
  app.graphql = await createGraphqlClient(app);

  return app;
};
