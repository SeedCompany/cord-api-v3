// noinspection JSUnusedGlobalSymbols

import { stripIndent } from 'common-tags';
import { difference, omit } from 'lodash';
import { many, Many } from '../../src/common';
import { GqlError } from './create-graphql-client';

// Consider replacing with Jest 29.4+ feature: https://jestjs.io/docs/expect#expectaddequalitytesterstesters

expect.extend({
  toThrowGqlError(received: GqlError, expected?: ErrorExpectations) {
    expect(received).toBeInstanceOf(GqlError);
    const error = received.raw;
    const { code, message, ...extensions } = expected ?? {};

    const expectedObj = {
      ...(code ? { codes: many(code) } : {}),
      ...(message ? { message } : {}),
      extensions,
    };
    const actualObj = {
      codes: error?.extensions?.codes ?? [],
      message: error?.message,
      extensions: omit(
        error?.extensions,
        'code',
        'codes',
        'status',
        'stacktrace',
      ),
    };

    const codesPassed = expectedObj.codes
      ? difference(expectedObj.codes, actualObj.codes).length === 0
      : true;
    const messagePassed = expectedObj.message
      ? expectedObj.message === actualObj.message
      : true;
    const extensionsPassed =
      Object.keys(expectedObj.extensions).length > 0
        ? !!this.utils.subsetEquality.call(
            this,
            expectedObj.extensions,
            actualObj.extensions,
            this.customTesters,
          )
        : true;
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
                  ${this.utils.RECEIVED_COLOR(actualObj.codes?.join(', '))}
              `.replace(/\n/g, '\n        ')
            : ''
        }
        ${
          !messagePassed
            ? stripIndent`
                Message:
                  ${this.utils.EXPECTED_COLOR(expectedObj.message)}
                  ${this.utils.RECEIVED_COLOR(actualObj.message)}
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
  },
});

export type ErrorExpectations = {
  code?: Many<string>;
  message?: string;
} & Partial<Record<string, any>>;

interface CustomMatchers<R = unknown> {
  toThrowGqlError: (expectations?: ErrorExpectations) => R;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Matchers<R> extends CustomMatchers<R> {}
  }
}
