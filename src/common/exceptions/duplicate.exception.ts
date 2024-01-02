import { ArgumentsHost } from '@nestjs/common';
import {
  GqlContextType as ContextKey,
  GqlExecutionContext,
} from '@nestjs/graphql';
import { lowerCase, upperFirst } from 'lodash';
import type { ExclusivityViolationError } from '~/core/edgedb';
import { InputException } from './input.exception';

/**
 * A duplicate was found where uniqueness is required.
 */
export class DuplicateException extends InputException {
  constructor(field: string, message?: string, previous?: Error) {
    super(
      message ?? `${field} already exists and needs to be unique`,
      field,
      previous,
    );
  }

  static fromDB(exception: ExclusivityViolationError, context?: ArgumentsHost) {
    let property = exception.property;
    const message = `${upperFirst(
      lowerCase(property),
    )} already exists and needs to be unique`;

    // Attempt to add path prefix automatically to the property name, based
    // on given GQL input.
    if (context && context.getType<ContextKey>() === 'graphql') {
      let gqlArgs = GqlExecutionContext.create(context as any).getArgs();

      // unwind single `input` argument, based on our own conventions
      if (Object.keys(gqlArgs).length === 1 && 'input' in gqlArgs) {
        gqlArgs = gqlArgs.input;
      }

      const flattened = flattenObject(gqlArgs);
      // Guess the correct path based on property name.
      // This kinda assumes the property name will be unique amongst all the input.
      const guessedPath = Object.keys(flattened).find(
        (path) => property === path || path.endsWith('.' + property),
      );
      property = guessedPath ?? property;
    }

    const ex = new DuplicateException(property, message, exception);
    ex.stack = exception.stack;
    return ex;
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
