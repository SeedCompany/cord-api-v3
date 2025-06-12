import { ConfigService } from '~/core';
import {
  type TestApp as LegacyTestApp,
  type GraphQLTestClient as LegacyTestClient,
} from '../../utility';
import { type TestApp } from '../create-app';
import { CookieJar, createExecute, type GqlExecute } from './gql-execute';

export interface Tester {
  run: GqlExecute;

  apply: <Output>(
    operation: (tester: this) => Promise<Output>,
  ) => Promise<Output>;

  /** @deprecated */
  legacyApp: LegacyTestApp;
}

export type Operation<R, TTester extends Tester = Tester> = (
  tester: TTester,
) => Promise<R>;

export const createTester = (app: TestApp): Tester => {
  const url = app.get(ConfigService).hostUrl$.value + 'graphql';

  const execute = createExecute({
    url,
    cookieJar: new CookieJar(),
  });

  const tester: Tester = {
    run: execute,
    apply(op) {
      return op(this);
    },
    /**
     * This will work to run GQL operations
     * unless those operations swap users.
     */
    get legacyApp(): LegacyTestApp {
      const graphql: LegacyTestClient = {
        query: execute,
        mutate: execute,
        get authToken() {
          throw new Error('Not supported in the new Tester');
        },
        set authToken(token: string) {
          throw new Error('Not supported in the new Tester');
        },
        email: undefined,
      };
      return Object.assign(Object.create(app), { graphql });
    },
  };
  return tester;
};
