import { INestApplication } from '@nestjs/common';
import got from 'got';
import {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
  print,
} from 'graphql';
import './expect-gql-error';

export interface GraphQLTestClient {
  query: <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars
  ) => Promise<TData>;
  mutate: <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars
  ) => Promise<TData>;
  authToken: string;
}

export const createGraphqlClient = async (
  app: INestApplication
): Promise<GraphQLTestClient> => {
  await app.listen(0);
  const url = await app.getUrl();

  let authToken = '';

  const execute = async <TData = AnyObject, TVars = AnyObject>(
    query: DocumentNode | string,
    variables?: TVars
  ) => {
    const result = await got
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
      .json<ExecutionResult<TData>>();

    validateResult(result);
    return result.data;
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

function validateResult<TData>(
  res: ExecutionResult<TData>
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
    err.name = raw.extensions.code;
    // must be after err constructor finishes to capture correctly.
    let frames = err.stack!.split('\n').slice(5);
    if (raw.extensions.exception) {
      frames = [...raw.extensions.exception.stacktrace, ...frames];
    }
    err.message = raw.message;
    err.stack = `${err.name}: ${err.message}\n` + frames.join('\n');
    return err;
  }
}

export type ExecutionResult<TData> = Omit<
  FormattedExecutionResult<TData>,
  'errors'
> & {
  errors?: readonly RawGqlError[];
};

export type RawGqlError = Omit<GraphQLFormattedError, 'extensions'> & {
  extensions: {
    code: string;
    codes: string[];
    status: number;
    exception?: {
      message: string;
      stacktrace: string[];
    };
  } & AnyObject;
};

interface AnyObject {
  [key: string]: any;
}
