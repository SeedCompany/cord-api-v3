// noinspection JSUnusedGlobalSymbols

import { stripIndent } from 'common-tags';
import { many, Many } from '../../src/common';
import { GqlError } from './create-graphql-client';

// Consider replacing with Jest 29.4+ feature: https://jestjs.io/docs/expect#expectaddequalitytesterstesters

expect.extend({
  toThrowGqlError(received: GqlError, expected?: ErrorExpectations) {
    expect(received).toBeInstanceOf(GqlError);
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
                  ${this.utils.RECEIVED_COLOR(actualObj.codes?.join(', '))}
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
