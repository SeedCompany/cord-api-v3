// noinspection JSUnusedGlobalSymbols

import { expect } from '@jest/globals';
import { stripIndent } from 'common-tags';
import { type AsymmetricMatchers, type MatcherFunction } from 'expect';
import { many, type Many } from '~/common';
import { GqlError } from './create-graphql-client';

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
      expectedObj.extensions,
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
                  ${this.utils
                    .diff(expectedObj.extensions, actualObj.extensions)
                    ?.replace(/\n/g, '\n                  ')
                    .split('\n')
                    .slice(4, -1)
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
