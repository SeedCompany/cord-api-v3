import { expect } from '@jest/globals';
import { stripIndent } from 'common-tags';
import { type AsymmetricMatchers, type MatcherFunction } from 'expect';
import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql';
import type { Merge } from 'type-fest';
import { many, type Many } from '~/common';

export class GqlResult<TData> implements PromiseLike<TData> {
  constructor(private readonly result: Promise<TData>) {}

  then: PromiseLike<TData>['then'] = (onFulfilled, onRejected) => {
    return this.result.then(onFulfilled, onRejected);
  };

  expectError(expectations: ErrorExpectations = {}): Promise<void> {
    return expect(this).rejects.toThrowGqlError(expectations);
  }
}

export type ExecutionResult<TData> = Omit<
  FormattedExecutionResult<TData>,
  'errors'
> & {
  errors?: readonly RawGqlError[];
};

/**
 * An error class consuming the JSON formatted GraphQL error.
 */
export class GqlError extends Error {
  constructor(readonly raw: RawGqlError) {
    super();
  }

  static from(raw: RawGqlError) {
    const err = new GqlError(raw);
    err.name = raw.extensions.codes[0]!;
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
export type RawGqlError = Merge<
  GraphQLFormattedError,
  {
    extensions: {
      codes: readonly string[];
      stacktrace?: readonly string[];
    };
  }
>;

// Consider replacing with Jest 29.4+ feature: https://jestjs.io/docs/expect#expectaddequalitytesterstesters

type AsymmetricMatcher = ReturnType<AsymmetricMatchers['anything']>;

export type ErrorExpectations = {
  code?: Many<string>;
  message?: string | AsymmetricMatcher;
} & Partial<Record<string, any>>;

const toThrowGqlError: MatcherFunction<[expected?: ErrorExpectations]> =
  function toThrowGqlError(actual, expected) {
    expect(actual).toBeInstanceOf(GqlError);
    const received = actual as GqlError;

    const { code, message, ...extensions } = expected ?? {};
    const expectedObj = {
      ...(code ? { codes: many(code) } : {}),
      ...(message ? { message } : {}),
      extensions,
    };

    const {
      codes: actualCodes,
      stacktrace: _,
      ...actualExtensions
    } = received.raw.extensions;
    const actualObj = {
      codes: actualCodes,
      message: received.raw.message,
      extensions: actualExtensions,
    };

    const codesPassed = this.equals(
      expect.arrayContaining(expectedObj.codes ?? []),
      actualObj.codes,
    );
    const messagePassed = this.equals(
      expectedObj.message ?? expect.anything(),
      actualObj.message,
    );
    const extensionsPassed = this.equals(
      expect.objectContaining(expectedObj.extensions),
      actualObj.extensions,
    );
    const pass = codesPassed && messagePassed && extensionsPassed;

    const genMessage = () => stripIndent`
      ${this.utils.matcherHint(`${this.isNot ? '.not' : ''}.toThrowGqlError`)}

      Expected GraphQL error with${
        this.isNot ? 'out' : ''
      } at least the following:
        ${
          !codesPassed
            ? stripIndent`
                Codes:
                  ${this.utils.EXPECTED_COLOR(expectedObj.codes?.join(', '))}
                  ${this.utils.RECEIVED_COLOR(actualObj.codes.join(', '))}
              `.replace(/\n/g, '\n        ')
            : ''
        }
        ${
          !messagePassed
            ? stripIndent`
                Message:
                  ${this.utils.printExpected(expectedObj.message)}
                  ${this.utils.printReceived(actualObj.message)}
              `.replace(/\n/g, '\n        ')
            : ''
        }
        ${
          !extensionsPassed
            ? stripIndent`
                Extensions:
                  ${(() => {
                    const lines = this.utils
                      .diff(expectedObj.extensions, actualObj.extensions)
                      ?.replace(/\n/g, '\n                  ')
                      .split('\n');
                    if (!lines) {
                      return [];
                    } else if (Object.keys(actualObj.extensions).length > 0) {
                      return lines.slice(4, -1);
                    } else {
                      return [
                        ...lines.slice(4, -2),
                        lines.at(-1)!.replace('Object {}', '  <empty>'),
                      ];
                    }
                  })()
                    .join('\n')
                    .trim()}
              `.replace(/\n/g, '\n        ')
            : ''
        }
      `;

    return { pass, message: genMessage };
  };

expect.extend({
  toThrowGqlError,
});

interface CustomMatchers<R = unknown> {
  toThrowGqlError: (expectations?: ErrorExpectations) => R;
}

declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Matchers<R> extends CustomMatchers<R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchers extends CustomMatchers {}
}
