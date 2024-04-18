import { INestApplication } from '@nestjs/common';
import got from 'got';
import {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
  print,
} from 'graphql';
import { Merge } from 'type-fest';
// eslint-disable-next-line import/no-duplicates
import { ErrorExpectations } from './expect-gql-error';
// eslint-disable-next-line import/no-duplicates -- ensures runtime execution
import './expect-gql-error';

export interface GraphQLTestClient {
  query: <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars,
  ) => GqlResult<TData>;
  mutate: <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars,
  ) => GqlResult<TData>;
  authToken: string;
}

export const createGraphqlClient = async (
  app: INestApplication,
): Promise<GraphQLTestClient> => {
  await app.listen(0);
  const url = await app.getUrl();

  let authToken = '';

  const execute = <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars,
  ) => {
    const result = got
      .post({
        url: `${url}/graphql`,
        throwHttpErrors: false,
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        json: {
          query: typeof query === 'string' ? query : print(query),
          variables,
        },
      })
      .json<ExecutionResult<TData>>()
      .then((result) => {
        validateResult(result);
        return result.data;
      });

    return new GqlResult(result);
  };

  return {
    query: execute,
    mutate: execute,
    get authToken() {
      return authToken;
    },
    set authToken(token: string) {
      authToken = token;
    },
  };
};

class GqlResult<TData> implements PromiseLike<TData> {
  constructor(private readonly result: Promise<TData>) {}

  then: PromiseLike<TData>['then'] = (onFulfilled, onRejected) => {
    return this.result.then(onFulfilled, onRejected);
  };

  expectError(expectations: ErrorExpectations = {}): Promise<void> {
    return expect(this).rejects.toThrowGqlError(expectations);
  }
}

function validateResult<TData>(
  res: ExecutionResult<TData>,
): asserts res is Omit<ExecutionResult<TData>, 'data' | 'errors'> & {
  data: TData;
} {
  if (res.errors && res.errors.length > 0) {
    throw GqlError.from(res.errors[0]);
  }
  expect(res.data).toBeTruthy();
}

/**
 * An error class consuming the JSON formatted GraphQL error.
 */
export class GqlError extends Error {
  constructor(readonly raw: RawGqlError) {
    super();
  }

  static from(raw: RawGqlError) {
    const err = new GqlError(raw);
    err.name = raw.extensions.codes[0];
    // must be after err constructor finishes to capture correctly.
    let frames = err.stack!.split('\n').slice(5);
    if (raw.extensions.stacktrace) {
      frames = [...raw.extensions.stacktrace, ...frames];
    }
    err.message = raw.message;
    const codes = raw.extensions.codes.join(', ');
    err.stack = `[${codes}]: ${err.message}\n\n` + frames.join('\n');
    return err;
  }
}

export type ExecutionResult<TData> = Omit<
  FormattedExecutionResult<TData>,
  'errors'
> & {
  errors?: readonly RawGqlError[];
};

export type RawGqlError = Merge<
  GraphQLFormattedError,
  {
    extensions: {
      codes: readonly string[];
      stacktrace?: readonly string[];
    };
  }
>;

interface AnyObject {
  [key: string]: any;
}
