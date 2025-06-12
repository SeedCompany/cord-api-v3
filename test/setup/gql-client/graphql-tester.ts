import { ConfigService } from '~/core';
import { type TestApp } from '../create-app';
import { CookieJar, createExecute, type GqlExecute } from './gql-execute';

export interface Tester {
  run: GqlExecute;

  apply: <Output>(
    operation: (tester: this) => Promise<Output>,
  ) => Promise<Output>;
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
  };
  return tester;
};
