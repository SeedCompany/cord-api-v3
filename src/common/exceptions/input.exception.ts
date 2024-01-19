import { ArgumentsHost } from '@nestjs/common';
import {
  GqlContextType as ContextKey,
  GqlExecutionContext,
} from '@nestjs/graphql';
import { ClientException } from './exception';

export type InputExceptionArgs =
  | [Error?]
  | [string, Error?]
  | [string, string?, Error?];

/**
 * Indicate the request cannot be completed because of requester has done
 * something wrong. This is comparable to a BadRequestException.
 */
export class InputException extends ClientException {
  /**
   * The field name in a.b.c nested notation from the Input DTO.
   */
  field: string | undefined;

  /**
   * Create using a default message if you don't want to be more specific
   *
   * @example
   * throw new InputException();
   *
   * @example
   * catch (e) {
   *   throw new InputException(e);
   * }
   *
   * @param previous A previous error if any
   */
  constructor(previous?: Error);

  /**
   * Create with a custom message
   *
   * @example
   * throw new InputException(`User's about must be written in MLA format`);
   *
   * @example
   * catch (e) {
   *   throw new InputException(`User's about must be written in MLA format`, e);
   * }
   *
   * @param message A human (dev) readable message
   * @param previous A previous error if any
   */
  constructor(message: string, previous?: Error);

  /**
   * @example
   * throw new InputException(
   *   `User's about must be written in MLA format`,
   *   'user.about'
   * );
   *
   * @example
   * catch (e) {
   *   throw new InputException(
   *     `User's about must be written in MLA format`,
   *     'user.about',
   *     e
   *   );
   * }
   *
   * @param message A human (dev) readable message
   * @param field The field name in a.b.c nested notation from the Input DTO.
   * @param previous A previous error if any
   */
  constructor(message: string, field?: string, previous?: Error);

  constructor(...args: InputExceptionArgs) {
    const [message, field, previous] = InputException.parseArgs(
      'Invalid request',
      args,
    );
    super(message, previous);
    this.field = field;
  }

  withField(field: string) {
    this.field = field;
    return this;
  }

  static parseArgs(
    defaultMessage: string,
    [one, two, three]: InputExceptionArgs,
  ) {
    let message = defaultMessage;
    let field;
    let previous;
    if (one instanceof Error) {
      previous = one;
    } else if (!one) {
      // no args, do nothing
    } else {
      message = one;
      if (two instanceof Error) {
        previous = two;
      } else {
        field = two;
        previous = three;
      }
    }
    return [message, field, previous] as const;
  }

  static getFlattenInput(context?: ArgumentsHost) {
    if (!context || context.getType<ContextKey>() !== 'graphql') {
      return {};
    }
    const gqlContext =
      context instanceof GqlExecutionContext
        ? context
        : GqlExecutionContext.create(context as any);
    let gqlArgs = gqlContext.getArgs();

    // unwind single `input` argument, based on our own conventions
    if (Object.keys(gqlArgs).length === 1 && 'input' in gqlArgs) {
      gqlArgs = gqlArgs.input;
    }

    return flattenObject(gqlArgs);
  }
}

const flattenObject = (obj: object, prefix = '') => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedObj = flattenObject(value, prefix + key + '.');
      Object.assign(result, nestedObj);
    } else {
      result[prefix + key] = value;
    }
  }
  return result;
};
