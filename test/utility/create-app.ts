import { type NestHttpApplication } from '~/core/http';
import { createApp } from '../setup/create-app';
import {
  createGraphqlClient,
  type GraphQLTestClient,
} from './create-graphql-client';

export interface TestApp extends NestHttpApplication {
  graphql: GraphQLTestClient;
}

export const createTestApp = async () => {
  const app = (await createApp()) as TestApp;

  return Object.assign(Object.create(app) as TestApp, {
    graphql: createGraphqlClient(app),
  });
};
