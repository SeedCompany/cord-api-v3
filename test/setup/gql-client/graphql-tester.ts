import { ConfigService } from '~/core';
import {
  type TestApp as LegacyTestApp,
  type GraphQLTestClient as LegacyTestClient,
} from '../../utility';
import { type TestApp } from '../create-app';
import { CookieJar, createExecute, type GqlExecute } from './gql-execute';

export interface Tester {
  run: GqlExecute;

  apply: <Output>(operation: (tester: this) => Output) => Output;

  /**
   * This is here to help facilitate migration.
   * It would probably be better to avoid using this, as it hides logic.
   */
  app: TestApp;

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
      const boundTester: Tester = Object.assign(Object.create(this ?? tester), {
        // Replace apply() given to operation, with a bound scope,
        // allowing the function to be destructured.
        // We wait to do this binding so that the tester can be subclassed.
        // identifiedTester.apply(({ apply }) => {
        //   apply(tester => {
        //     tester.identity;
        //   });
        // });
        apply: (op2: Operation<any>) => op2(boundTester),
      });
      return op(boundTester);
    },
    app,
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
