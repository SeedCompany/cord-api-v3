import { ArgumentsHost } from '@nestjs/common';
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
    // This kinda assumes the property name will be unique amongst all the input.
    const guessedPath = Object.keys(
      InputException.getFlattenInput(context),
    ).find((path) => property === path || path.endsWith('.' + property));
    property = guessedPath ?? property;

    return new DuplicateException(property, message, exception);
  }
}
