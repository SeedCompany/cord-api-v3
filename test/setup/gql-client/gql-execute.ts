import { type TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
import { expect } from '@jest/globals';
import { asNonEmptyArray } from '@seedcompany/common';
import got, { type PromiseCookieJar, type StrictOptions } from 'got';
import { print } from 'graphql';
import type { HasRequiredKeys } from 'type-fest';
import { type ExecutionResult, GqlError, GqlResult } from './gql-result';

export type GqlExecute = <Input extends AnyObject, Output extends AnyObject>(
  query: DocumentNode<Output, Input>,
  ...variables: VarsArg<NoInfer<Input>>
) => GqlResult<Output>;

interface AnyObject {
  [key: string]: any;
}

type VarsArg<Vars extends AnyObject> =
  Vars extends Record<any, never>
    ? []
    : HasRequiredKeys<Vars> extends true
      ? [variables: Vars]
      : [variables?: Vars];

export const createExecute = (options: StrictOptions): GqlExecute => {
  const execute = <Input extends AnyObject, Output extends AnyObject>(
    doc: DocumentNode<Output, Input>,
    variables?: Input,
  ) => {
    const query = print(doc);
    const result = got
      .post({
        ...options,
        throwHttpErrors: false,
        json: {
          query,
          variables,
        },
        retry: {
          // Retry queries, not mutations
          methods: query.startsWith('query') ? ['POST'] : [],
        },
      })
      .json<ExecutionResult<Output>>()
      .then((result) => {
        validateResult(result);
        return result.data;
      });

    return new GqlResult<Output>(result);
  };

  return execute;
};

function validateResult<TData>(
  res: ExecutionResult<TData>,
): asserts res is Omit<ExecutionResult<TData>, 'data' | 'errors'> & {
  data: TData;
} {
  const errors = asNonEmptyArray(res.errors ?? []);
  if (errors) {
    throw GqlError.from(errors[0]);
  }
  expect(res.data).toBeTruthy();
}

export class CookieJar implements PromiseCookieJar {
  readonly cookies: Map<string, string>;
  constructor(cookies?: Iterable<readonly [string, string]>) {
    this.cookies = new Map(cookies);
  }
  async getCookieString(url: string) {
    return this.cookies.get(url) ?? '';
  }
  async setCookie(rawCookie: string, url: string) {
    this.cookies.set(url, rawCookie);
  }
}
