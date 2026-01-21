import { type NestHttpApplication } from '~/core/http';
import { createApp } from '../setup/create-app';
import {
  createGraphqlClient,
  type GraphQLTestClient,
} from './create-graphql-client';

/**
 * @deprecated use {@link import("../setup").TestApp} instead
 */
export interface TestApp extends NestHttpApplication {
  /**
   * @deprecated use {@link import("../setup").Tester} instead
   */
  graphql: GraphQLTestClient;
}

/**
 * @deprecated use {@link createApp} instead
 */
export const createTestApp = async () => {
  const app = (await createApp()) as TestApp;

  return Object.assign(Object.create(app) as TestApp, {
    graphql: createGraphqlClient(app),
  });
};
