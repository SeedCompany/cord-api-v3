import { type NestHttpApplication } from '~/core/http';
import { createApp, type Tester } from '../setup';
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

  /** @deprecated */
  tester: Tester;
}

/**
 * @deprecated use {@link createApp} instead
 */
export const createTestApp = async () => {
  let app = (await createApp()) as TestApp;

  app = Object.assign(Object.create(app) as TestApp, {
    graphql: createGraphqlClient(app),
  });

  app.tester = {
    http: app.graphql.http,
    run: app.graphql.query,
    apply(op) {
      return op(app.tester);
    },
    app,
    legacyApp: app,
  };

  return app;
};
