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
}
